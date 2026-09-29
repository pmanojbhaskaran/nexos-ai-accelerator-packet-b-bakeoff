import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LaneClass, Mode, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEventService } from '../shipments/audit-event.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { CoLoaderResponsibilityService } from '../coloader-responsibility/coloader-responsibility.service';
import { FinanceService } from '../finance/finance.service';
import { CoreLogisticsOpsService } from '../core-logistics-ops/core-logistics-ops.service';
import { PayablesDisciplineService } from '../treasury/payables-discipline/payables-discipline.service';
import { HrmsOpsService } from '../hrms-ops/hrms-ops.service';
import { ExceptionsService } from '../exceptions/exceptions.service';
import { MovementMasterService } from '../movement-master/movement-master.service';
import { DeliveryPodClosureService } from '../delivery-pod-closure/delivery-pod-closure.service';
import {
  assertV0DomesticMovementMode,
  evaluateLaneServiceability,
  buildGstInvoiceReadyOutput,
  CO_LOADER_CONFIG,
  deriveExceptionOwner,
  evaluateAiDisabledCoreGate,
  evaluateAttendancePolicy,
  evaluateHandoverProofGate,
  evaluateLaterReleaseGuard,
  isV0CounterpartyType,
  isV0RuntimeExceptionType,
  nextBagLifecycleStatus,
  productizeCoLoaderFlowPlan,
  V0_EMPLOYEE_DEPARTMENT_CODES,
  V1_AI_DISABLED_SURFACES,
  type BagLifecycleStatus,
  type CoLoaderConfig,
} from 'nexos-courier-shared';
import { V1DomesticLaunchService, resolveGovernedAttendanceFacts } from '../v1-domestic-launch/v1-domestic-launch.service';
import { computeTax } from '../invoicing-tax-settlement-authority/invoicing-tax-settlement-validator';
import { formatTallyDate, mapCustomerInvoiceToTallyVoucher, mapPayableToTallyVoucher } from '../connectors/tally/tally-voucher-export.mapper';
import { serializeTallyNativeXml, tallyNativeXmlDownloadName, validateTallyNativeXmlStructure, TALLY_NATIVE_XML_FORMAT } from '../connectors/tally/tally-native-xml.serializer';
import type { TallyLedgerMapping, TallyNativeVoucher, TallyTaxComponents } from '../connectors/tally/tally-voucher-export.types';
import { listSubmittedStep5FacilityNodes } from '../tenant-setup-workbench/tenant-setup-submitted-facility-nodes';

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function optionalDecimal(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') return value;
  return null;
}

function optionalInt(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    if (parsed == null) return undefined;
    if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'object') return parsed as Prisma.InputJsonValue;
    return undefined;
  } catch {
    return undefined;
  }
}

function optionalNullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return optionalJson(value) ?? Prisma.DbNull;
}

function asLaneClass(value: unknown): LaneClass {
  switch (value) {
    case 'FIRST_MILE':
    case 'MIDDLE_MILE':
    case 'LINEHAUL':
    case 'LAST_MILE':
    case 'TRANSFER':
    case 'RETURN':
      return value;
    default:
      return LaneClass.LINEHAUL;
  }
}

@Injectable()
export class V0ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditEventService,
    @Optional() private readonly shipments?: ShipmentsService,
    @Optional() private readonly coloader?: CoLoaderResponsibilityService,
    @Optional() private readonly finance?: FinanceService,
    @Optional() private readonly logistics?: CoreLogisticsOpsService,
    @Optional() private readonly payables?: PayablesDisciplineService,
    @Optional() private readonly hrms?: HrmsOpsService,
    @Optional() private readonly exceptions?: ExceptionsService,
    @Optional() private readonly movement?: MovementMasterService,
    @Optional() private readonly delivery?: DeliveryPodClosureService,
    @Optional() private readonly v1?: V1DomesticLaunchService,
  ) {}

  private db() {
    return this.prisma;
  }

  private async auditChange(params: {
    tenantId: string;
    actorId: string;
    eventName: string;
    sourceRecordType: string;
    sourceRecordId: string;
    payload?: unknown;
  }) {
    await this.audit.emitGenericAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      eventName: params.eventName,
      sourceRecordType: params.sourceRecordType,
      sourceRecordId: params.sourceRecordId,
      correlationId: `v0_${Date.now()}_${params.sourceRecordId}`,
      payload: params.payload ?? {},
    });
  }

  assertTenantBound<T extends { tenantId?: string; tenant_id?: string }>(row: T | null, tenantId: string, label: string): T {
    if (!row) throw new NotFoundException(`${label} not found`);
    const rowTenant = row.tenantId ?? row.tenant_id;
    if (rowTenant !== tenantId) throw new ForbiddenException('CROSS_TENANT_ACCESS_DENIED');
    return row;
  }

  evaluateIsolation(actorTenantId: string, recordTenantId: string) {
    if (actorTenantId !== recordTenantId) throw new ForbiddenException('CROSS_TENANT_ACCESS_DENIED');
    return { allowed: true };
  }

  evaluateLaterRelease(input: { capabilityCode?: string; webPath?: string; apiPath?: string }) {
    const result = evaluateLaterReleaseGuard(input);
    if (!result.allowed) throw new ForbiddenException({ code: 'LATER_RELEASE_BLOCKED', blockers: result.blockers });
    return result;
  }

  async upsertDepartment(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new ConflictException('DEPARTMENT_CODE_AND_NAME_REQUIRED');
    const row = await this.db().tenantDepartment.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, name, status: String(body.status ?? 'ACTIVE') },
      update: { name, status: String(body.status ?? 'ACTIVE') },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'tenant.department.upserted.v1', sourceRecordType: 'TenantDepartment', sourceRecordId: row.id, payload: { code, name } });
    return row;
  }

  async listDepartments(tenantId: string, status?: string) {
    return this.db().tenantDepartment.findMany({ where: { tenantId, ...(status ? { status } : {}) }, orderBy: { code: 'asc' } });
  }

  async getDepartment(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().tenantDepartment.findFirst({ where: { id } }), tenantId, 'Department');
  }

  async setDepartmentStatus(tenantId: string, actorId: string, id: string, status: 'ACTIVE' | 'INACTIVE') {
    const existing = await this.getDepartment(tenantId, id);
    const row = await this.db().tenantDepartment.update({ where: { id: existing.id }, data: { status } });
    await this.auditChange({ tenantId, actorId, eventName: 'tenant.department.status.v1', sourceRecordType: 'TenantDepartment', sourceRecordId: row.id, payload: { status } });
    return row;
  }

  async upsertDesignation(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new ConflictException('DESIGNATION_CODE_AND_NAME_REQUIRED');
    const row = await this.db().tenantDesignation.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, name, departmentCode: optionalText(body.departmentCode), status: String(body.status ?? 'ACTIVE') },
      update: { name, departmentCode: optionalText(body.departmentCode), status: String(body.status ?? 'ACTIVE') },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'tenant.designation.upserted.v1', sourceRecordType: 'TenantDesignation', sourceRecordId: row.id, payload: { code, name } });
    return row;
  }

  async listDesignations(tenantId: string, status?: string) {
    return this.db().tenantDesignation.findMany({ where: { tenantId, ...(status ? { status } : {}) }, orderBy: { code: 'asc' } });
  }

  async getDesignation(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().tenantDesignation.findFirst({ where: { id } }), tenantId, 'Designation');
  }

  async setDesignationStatus(tenantId: string, actorId: string, id: string, status: 'ACTIVE' | 'INACTIVE') {
    const existing = await this.getDesignation(tenantId, id);
    const row = await this.db().tenantDesignation.update({ where: { id: existing.id }, data: { status } });
    await this.auditChange({ tenantId, actorId, eventName: 'tenant.designation.status.v1', sourceRecordType: 'TenantDesignation', sourceRecordId: row.id, payload: { status } });
    return row;
  }

  async seedDefaultDepartments(tenantId: string, actorId: string) {
    const rows = [];
    for (const code of V0_EMPLOYEE_DEPARTMENT_CODES) {
      rows.push(await this.upsertDepartment(tenantId, actorId, { code, name: code.replace(/_/g, ' ') }));
    }
    return rows;
  }

  async upsertOrganizationDepartments(tenantId: string, actorId: string, body: Record<string, unknown>) {
    if (Array.isArray(body.departments)) {
      const rows = [];
      for (const dept of body.departments as Array<Record<string, unknown>>) {
        const name = String(dept.name ?? '').trim();
        const code = String(dept.code ?? name).trim().toUpperCase().replace(/\s+/g, '_');
        const department = await this.upsertDepartment(tenantId, actorId, { code, name, status: 'ACTIVE' });
        const designations = Array.isArray(dept.designations) ? dept.designations as Array<Record<string, unknown>> : [];
        for (const designation of designations) {
          const designationName = String(designation.name ?? '').trim();
          if (!designationName) continue;
          await this.upsertDesignation(tenantId, actorId, {
            code: designationName.toUpperCase().replace(/\s+/g, '_'),
            name: designationName,
            departmentCode: code,
          });
        }
        rows.push(department);
      }
      if (Array.isArray(body.roles)) {
        for (const role of body.roles as Array<Record<string, unknown>>) {
          const name = String(role.name ?? '').trim();
          const code = String(role.code ?? name).trim().toUpperCase().replace(/\s+/g, '_');
          if (!code || !name) continue;
          await this.upsertDesignation(tenantId, actorId, { code, name, status: role.status ?? 'ACTIVE' });
        }
      }
      return rows;
    }
    if (Array.isArray(body.roles)) {
      for (const role of body.roles as Array<Record<string, unknown>>) {
        const name = String(role.name ?? '').trim();
        const code = String(role.code ?? name).trim().toUpperCase().replace(/\s+/g, '_');
        if (!code || !name) continue;
        await this.upsertDesignation(tenantId, actorId, { code, name, status: role.status ?? 'ACTIVE' });
      }
      return this.listDesignations(tenantId);
    }
    return this.upsertDepartment(tenantId, actorId, body);
  }

  private assignedShiftCode(value: unknown): string {
    return value ? String(value).trim().toUpperCase() : '';
  }

  private async assertAssignedMasters(tenantId: string, body: Record<string, unknown>) {
    const departmentCode = body.departmentCode ? String(body.departmentCode).trim().toUpperCase() : '';
    const designationCode = body.designationCode ? String(body.designationCode).trim().toUpperCase() : '';
    const shiftDefinitionCode = this.assignedShiftCode(body.shiftDefinitionCode);
    if (departmentCode) {
      const department = await this.db().tenantDepartment.findFirst({ where: { tenantId, code: departmentCode } });
      if (!department) throw new ConflictException('DEPARTMENT_MASTER_REQUIRED');
    }
    if (designationCode) {
      const designation = await this.db().tenantDesignation.findFirst({ where: { tenantId, code: designationCode } });
      if (!designation) throw new ConflictException('DESIGNATION_MASTER_REQUIRED');
      if (String(designation.status) === 'INACTIVE') throw new ConflictException('DESIGNATION_INACTIVE');
    }
    if (shiftDefinitionCode) {
      const shift = await this.db().shiftDefinition.findFirst({ where: { tenantId, code: shiftDefinitionCode } });
      if (!shift) throw new ConflictException('SHIFT_MASTER_REQUIRED');
      if (String(shift.status) === 'INACTIVE') throw new ConflictException('SHIFT_INACTIVE');
    }
  }

  async listFacilityNodes(tenantId: string) {
    return listSubmittedStep5FacilityNodes(this.db(), tenantId);
  }

  private incomingFacilityCode(body: Record<string, unknown>): string | undefined {
    if (!Object.prototype.hasOwnProperty.call(body, 'facilityRef') && !Object.prototype.hasOwnProperty.call(body, 'siteRef')) {
      return undefined;
    }
    return String(optionalText(body.facilityRef) ?? optionalText(body.siteRef) ?? '').trim();
  }

  private async resolveFacilityCode(tenantId: string, proposed: string): Promise<string> {
    const nodes = await this.listFacilityNodes(tenantId);
    const match = nodes.find((row) => row.facilityCode.toUpperCase() === proposed.trim().toUpperCase());
    if (!match) throw new ConflictException('FACILITY_MASTER_REQUIRED');
    return match.facilityCode;
  }

  private async assertWeeklyOffAssignment(tenantId: string, body: Record<string, unknown>) {
    const employeeRef = optionalText(body.employeeRef);
    if (employeeRef) {
      await this.resolveEmployee(tenantId, employeeRef);
    }
    const shiftCode = this.assignedShiftCode(body.shiftCode);
    if (shiftCode) {
      const shift = await this.db().shiftDefinition.findFirst({ where: { tenantId, code: shiftCode } });
      if (!shift) throw new ConflictException('SHIFT_MASTER_REQUIRED');
      if (String(shift.status) === 'INACTIVE') throw new ConflictException('SHIFT_INACTIVE');
    }
  }

  private async resolveEmployee(tenantId: string, employeeRef: string) {
    const byId = await this.db().employee.findFirst({ where: { id: employeeRef } });
    if (byId) return this.assertTenantBound(byId, tenantId, 'Employee');
    const byCode = await this.db().employee.findFirst({ where: { employeeCode: employeeRef } });
    if (byCode) return this.assertTenantBound(byCode, tenantId, 'Employee');
    throw new NotFoundException('Employee not found');
  }

  async createEmployee(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const employeeCode = String(body.employeeCode ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    if (!employeeCode || !fullName) throw new ConflictException('EMPLOYEE_CODE_AND_NAME_REQUIRED');
    await this.assertAssignedMasters(tenantId, body);
    const existing = await this.db().employee.findFirst({ where: { tenantId, employeeCode } });
    if (existing) throw new ConflictException('EMPLOYEE_CODE_EXISTS');
    const assignedShiftCode = this.assignedShiftCode(body.shiftDefinitionCode) || optionalText(body.shiftDefinitionCode);
    const proposedFacility = String(optionalText(body.facilityRef) ?? optionalText(body.siteRef) ?? '').trim();
    const assignedFacilityCode = proposedFacility ? await this.resolveFacilityCode(tenantId, proposedFacility) : null;
    const row = await this.db().employee.create({
      data: {
        tenantId,
        employeeCode,
        fullName,
        email: optionalText(body.email),
        phone: optionalText(body.phone),
        department: optionalText(body.department) ?? optionalText(body.departmentCode),
        designation: optionalText(body.designation) ?? optionalText(body.designationCode),
        departmentCode: optionalText(body.departmentCode),
        designationCode: optionalText(body.designationCode),
        managerId: optionalText(body.managerId),
        facilityRef: assignedFacilityCode,
        siteRef: assignedFacilityCode ?? optionalText(body.siteRef) ?? optionalText(body.facilityRef),
        shiftDefinitionCode: assignedShiftCode,
        shiftPattern: assignedShiftCode ?? optionalText(body.shiftPattern),
        attendanceEligible: body.attendanceEligible !== false,
        employmentType: optionalText(body.employmentType) ?? 'FULL_TIME',
        joinDate: body.joinDate ? new Date(String(body.joinDate)) : new Date(),
        status: optionalText(body.status) ?? 'ACTIVE',
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'employee.created.v1', sourceRecordType: 'Employee', sourceRecordId: row.id, payload: { employeeCode } });
    return row;
  }

  async getEmployee(tenantId: string, id: string) {
    return this.resolveEmployee(tenantId, id);
  }

  async listEmployees(tenantId: string, query: Record<string, string | undefined>) {
    const attendanceEligible =
      query.attendanceEligible === 'true' ? true : query.attendanceEligible === 'false' ? false : undefined;
    const items = await this.db().employee.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.departmentCode ? { departmentCode: query.departmentCode } : {}),
        ...(query.designationCode ? { designationCode: query.designationCode } : {}),
        ...(query.facilityRef ? { facilityRef: query.facilityRef } : {}),
        ...(query.shiftDefinitionCode ? { shiftDefinitionCode: query.shiftDefinitionCode } : {}),
        ...(attendanceEligible === undefined ? {} : { attendanceEligible }),
      },
      orderBy: { employeeCode: 'asc' },
    });
    return { items, total: items.length };
  }

  async updateEmployee(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.resolveEmployee(tenantId, id);
    await this.assertAssignedMasters(tenantId, body);
    const forbidden = ['salaryStructureRef', 'uanNumber', 'panNumber', 'bankAccountNumber'];
    for (const key of forbidden) delete body[key];
    const incomingFacility = this.incomingFacilityCode(body);
    let nextFacilityRef = existing.facilityRef;
    if (incomingFacility !== undefined) {
      if (incomingFacility && incomingFacility.toUpperCase() !== String(existing.facilityRef ?? '').trim().toUpperCase()) {
        nextFacilityRef = await this.resolveFacilityCode(tenantId, incomingFacility);
      } else if (!incomingFacility) {
        nextFacilityRef = optionalText(body.facilityRef) ?? optionalText(body.siteRef) ?? existing.facilityRef;
      }
    }
    const row = await this.db().employee.update({
      where: { id: existing.id },
      data: {
        fullName: optionalText(body.fullName) ?? existing.fullName,
        department: optionalText(body.department) ?? optionalText(body.departmentCode) ?? existing.department,
        designation: optionalText(body.designation) ?? optionalText(body.designationCode) ?? existing.designation,
        departmentCode: optionalText(body.departmentCode) ?? existing.departmentCode,
        designationCode: optionalText(body.designationCode) ?? existing.designationCode,
        managerId: optionalText(body.managerId) ?? existing.managerId,
        facilityRef: nextFacilityRef,
        shiftDefinitionCode: this.assignedShiftCode(body.shiftDefinitionCode) || (optionalText(body.shiftDefinitionCode) ?? existing.shiftDefinitionCode),
        attendanceEligible: typeof body.attendanceEligible === 'boolean' ? body.attendanceEligible : existing.attendanceEligible,
        status: optionalText(body.status) ?? existing.status,
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'employee.updated.v1', sourceRecordType: 'Employee', sourceRecordId: row.id, payload: body });
    return row;
  }

  async setEmployeeStatus(tenantId: string, actorId: string, id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.updateEmployee(tenantId, actorId, id, { status });
  }

  async upsertShift(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    if (!code || !name || !body.startTime || !body.endTime) throw new ConflictException('SHIFT_FIELDS_REQUIRED');
    const row = await this.db().shiftDefinition.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, name, startTime: String(body.startTime), endTime: String(body.endTime), status: String(body.status ?? 'ACTIVE') },
      update: { name, startTime: String(body.startTime), endTime: String(body.endTime), status: String(body.status ?? 'ACTIVE') },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'shift.definition.upserted.v1', sourceRecordType: 'ShiftDefinition', sourceRecordId: row.id, payload: { code } });
    return row;
  }

  async listShifts(tenantId: string) {
    return this.db().shiftDefinition.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async getShift(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().shiftDefinition.findFirst({ where: { id } }), tenantId, 'ShiftDefinition');
  }

  async updateShift(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.getShift(tenantId, id);
    const row = await this.db().shiftDefinition.update({
      where: { id: existing.id },
      data: {
        name: optionalText(body.name) ?? existing.name,
        startTime: optionalText(body.startTime) ?? existing.startTime,
        endTime: optionalText(body.endTime) ?? existing.endTime,
        status: optionalText(body.status) ?? existing.status,
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'shift.definition.updated.v1', sourceRecordType: 'ShiftDefinition', sourceRecordId: row.id, payload: body });
    return row;
  }

  async upsertWeeklyOff(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map(String) : [];
    if (!code || weekdays.length === 0) throw new ConflictException('WEEKLY_OFF_FIELDS_REQUIRED');
    await this.assertWeeklyOffAssignment(tenantId, body);
    const assignedShiftCode = this.assignedShiftCode(body.shiftCode) || optionalText(body.shiftCode);
    const row = await this.db().weeklyOffPattern.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, weekdays, employeeRef: optionalText(body.employeeRef), shiftCode: assignedShiftCode, status: 'ACTIVE' },
      update: { weekdays, employeeRef: optionalText(body.employeeRef), shiftCode: assignedShiftCode, status: String(body.status ?? 'ACTIVE') },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'weekly_off.upserted.v1', sourceRecordType: 'WeeklyOffPattern', sourceRecordId: row.id, payload: { code, weekdays } });
    return row;
  }

  async upsertHoliday(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const holidayCode = String(body.holidayCode ?? body.code ?? '').trim().toUpperCase();
    const holidayName = String(body.holidayName ?? body.name ?? '').trim();
    const holidayDate = new Date(String(body.holidayDate ?? body.date));
    if (!holidayCode || !holidayName || Number.isNaN(holidayDate.getTime())) throw new ConflictException('HOLIDAY_FIELDS_REQUIRED');
    const row = await this.prisma.holidayCalendar.upsert({
      where: { tenantId_holidayCode: { tenantId, holidayCode } },
      create: {
        tenantId, holidayCode, holidayName, holidayDate,
        holidayType: String(body.holidayType ?? 'NATIONAL'),
        fiscalYear: String(body.fiscalYear ?? holidayDate.getFullYear()),
        status: String(body.status ?? 'ACTIVE'),
      },
      update: { holidayName, holidayDate, status: String(body.status ?? 'ACTIVE') },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'holiday.upserted.v1', sourceRecordType: 'HolidayCalendar', sourceRecordId: row.id, payload: { holidayCode } });
    return row;
  }

  async listHolidays(tenantId: string) {
    return this.prisma.holidayCalendar.findMany({ where: { tenantId }, orderBy: { holidayDate: 'asc' } });
  }

  async getHoliday(tenantId: string, id: string) {
    return this.assertTenantBound(await this.prisma.holidayCalendar.findFirst({ where: { id } }), tenantId, 'HolidayCalendar');
  }

  async listWeeklyOffs(tenantId: string) {
    return this.db().weeklyOffPattern.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async getWeeklyOff(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().weeklyOffPattern.findFirst({ where: { id } }), tenantId, 'WeeklyOffPattern');
  }

  async updateWeeklyOff(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.getWeeklyOff(tenantId, id);
    await this.assertWeeklyOffAssignment(tenantId, body);
    const row = await this.db().weeklyOffPattern.update({
      where: { id: existing.id },
      data: {
        ...(Array.isArray(body.weekdays) ? { weekdays: body.weekdays.map(String) } : {}),
        employeeRef: optionalText(body.employeeRef) ?? existing.employeeRef,
        shiftCode: this.assignedShiftCode(body.shiftCode) || (optionalText(body.shiftCode) ?? existing.shiftCode),
        status: optionalText(body.status) ?? existing.status,
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'weekly_off.updated.v1', sourceRecordType: 'WeeklyOffPattern', sourceRecordId: row.id, payload: body });
    return row;
  }

  async updateHoliday(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.getHoliday(tenantId, id);
    const row = await this.prisma.holidayCalendar.update({
      where: { id: existing.id },
      data: {
        holidayName: optionalText(body.holidayName) ?? optionalText(body.name) ?? existing.holidayName,
        status: optionalText(body.status) ?? existing.status,
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'holiday.updated.v1', sourceRecordType: 'HolidayCalendar', sourceRecordId: row.id, payload: body });
    return row;
  }

  private async evaluatePunchStatus(input: {
    tenantId: string;
    employee: { id: string; employeeCode?: string | null; shiftDefinitionCode?: string | null };
    day: Date;
    checkInAt?: Date | null;
    checkOutAt?: Date | null;
    shiftRef?: string | null;
    evaluateClose?: boolean;
  }) {
    const facts = await resolveGovernedAttendanceFacts(this.db(), {
      tenantId: input.tenantId,
      employee: input.employee,
      attendanceDate: input.day.toISOString().slice(0, 10),
      actualShiftCode: input.shiftRef ?? null,
    });
    return evaluateAttendancePolicy({
      tenantId: input.tenantId,
      employeeRef: input.employee.id,
      attendanceDate: facts.attendanceDate,
      checkInAt: input.checkInAt ? input.checkInAt.toISOString() : null,
      checkOutAt: input.checkOutAt ? input.checkOutAt.toISOString() : null,
      scheduledStartAt: facts.scheduledStartAt,
      scheduledEndAt: facts.scheduledEndAt,
      isHoliday: facts.isHoliday,
      isRestDay: facts.isRestDay,
      shiftAssigned: facts.shiftAssigned,
      assignedShiftCode: facts.assignedShiftCode,
      actualShiftCode: facts.actualShiftCode,
      policy: facts.policy,
      evaluateClose: input.evaluateClose === true,
    });
  }

  async punchAttendance(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const employeeRef = String(body.employeeRef ?? '');
    const action = String(body.action ?? 'CHECK_IN').toUpperCase();
    const employee = await this.resolveEmployee(tenantId, employeeRef);
    if (employee.attendanceEligible === false) throw new ConflictException('EMPLOYEE_NOT_ATTENDANCE_ELIGIBLE');
    const day = new Date(String(body.attendanceDate ?? new Date().toISOString().slice(0, 10)));
    const existing = await this.prisma.attendanceRecord.findFirst({ where: { tenantId, employeeRef: employee.id, attendanceDate: day } });
    const now = body.timestamp ? new Date(String(body.timestamp)) : new Date();
    const requestShiftRef = optionalText(body.shiftRef);
    const shiftRef = requestShiftRef ?? employee.shiftDefinitionCode;
    if (action === 'CHECK_IN') {
      if (existing?.checkInAt) throw new ConflictException('ALREADY_CHECKED_IN');
      const evaluation = await this.evaluatePunchStatus({ tenantId, employee, day, checkInAt: now, shiftRef: requestShiftRef });
      const row = existing
        ? await this.prisma.attendanceRecord.update({ where: { id: existing.id }, data: { checkInAt: now, status: evaluation.status as any, lateByMinutes: evaluation.lateByMinutes, shiftRef, source: String(body.source ?? 'WEB') } })
        : await this.prisma.attendanceRecord.create({
          data: {
            tenantId, employeeRef: employee.id, attendanceDate: day, status: evaluation.status as any,
            checkInAt: now, lateByMinutes: evaluation.lateByMinutes, shiftRef: shiftRef ?? null,
            siteRef: employee.facilityRef ?? null, source: String(body.source ?? 'WEB'),
          },
        });
      await this.auditChange({ tenantId, actorId, eventName: 'attendance.check_in.v1', sourceRecordType: 'AttendanceRecord', sourceRecordId: row.id, payload: { employeeRef: employee.id, evaluation } });
      return { action: 'CHECK_IN', record: row, evaluation };
    }
    if (!existing?.checkInAt) throw new ConflictException('CHECK_IN_REQUIRED_BEFORE_CHECK_OUT');
    const evaluation = await this.evaluatePunchStatus({
      tenantId, employee, day, checkInAt: existing.checkInAt, checkOutAt: now, shiftRef: existing.shiftRef ?? requestShiftRef, evaluateClose: true,
    });
    const row = await this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkOutAt: now, hoursWorked: evaluation.hoursWorked, status: evaluation.status as any, lateByMinutes: evaluation.lateByMinutes },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'attendance.check_out.v1', sourceRecordType: 'AttendanceRecord', sourceRecordId: row.id, payload: { employeeRef: employee.id, evaluation } });
    return { action: 'CHECK_OUT', record: row, evaluation };
  }

  async currentAttendance(tenantId: string, employeeRef: string) {
    const employee = await this.resolveEmployee(tenantId, employeeRef);
    const day = new Date(new Date().toISOString().slice(0, 10));
    const record = await this.prisma.attendanceRecord.findFirst({ where: { tenantId, employeeRef: employee.id, attendanceDate: day } });
    return { employee, record, state: !record ? 'NOT_STARTED' : record.checkOutAt ? 'CHECKED_OUT' : 'CHECKED_IN', evaluatedStatus: record?.status ?? null };
  }

  async upsertCounterparty(tenantId: string, actorId: string, body: Record<string, unknown>) {
    if (!isV0CounterpartyType(body.partyType)) throw new ConflictException('INVALID_COUNTERPARTY_TYPE');
    const partyCode = String(body.partyCode ?? '').trim().toUpperCase();
    const legalName = String(body.legalName ?? '').trim();
    if (!partyCode || !legalName) throw new ConflictException('COUNTERPARTY_CODE_AND_NAME_REQUIRED');
    const row = await this.db().externalCounterparty.upsert({
      where: { tenantId_partyCode: { tenantId, partyCode } },
      create: {
        tenantId, partyCode, partyType: body.partyType, legalName,
        displayName: String(body.displayName ?? legalName),
        status: String(body.status ?? 'ACTIVE'),
        contactName: optionalText(body.contactName), contactPhone: optionalText(body.contactPhone), contactEmail: optionalText(body.contactEmail),
        addressLine1: optionalText(body.addressLine1), city: optionalText(body.city), state: optionalText(body.state), postalCode: optionalText(body.postalCode),
        capabilities: optionalNullableJson(body.capabilities),
      },
      update: {
        legalName, displayName: String(body.displayName ?? legalName), status: String(body.status ?? 'ACTIVE'),
        contactName: optionalText(body.contactName), capabilities: optionalNullableJson(body.capabilities),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'counterparty.upserted.v1', sourceRecordType: 'ExternalCounterparty', sourceRecordId: row.id, payload: { partyCode, partyType: body.partyType } });
    return row;
  }

  async listCounterparties(tenantId: string, partyType?: string) {
    return this.db().externalCounterparty.findMany({
      where: { tenantId, ...(partyType ? { partyType } : {}) },
      orderBy: { partyCode: 'asc' },
    });
  }

  async getCounterparty(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().externalCounterparty.findFirst({ where: { id } }), tenantId, 'ExternalCounterparty');
  }

  async updateCounterparty(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.getCounterparty(tenantId, id);
    if (body.partyType && !isV0CounterpartyType(body.partyType)) throw new ConflictException('INVALID_COUNTERPARTY_TYPE');
    const row = await this.db().externalCounterparty.update({
      where: { id: existing.id },
      data: {
        legalName: optionalText(body.legalName) ?? existing.legalName,
        displayName: optionalText(body.displayName) ?? existing.displayName,
        status: optionalText(body.status) ?? existing.status,
        contactName: optionalText(body.contactName) ?? existing.contactName,
        capabilities: body.capabilities === undefined ? undefined : optionalNullableJson(body.capabilities),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'counterparty.updated.v1', sourceRecordType: 'ExternalCounterparty', sourceRecordId: row.id, payload: body });
    return row;
  }

  async upsertLane(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const from = String(body.fromFacilityCode ?? body.from_facility_code ?? '');
    const to = String(body.toFacilityCode ?? body.to_facility_code ?? '');
    const serviceability = evaluateLaneServiceability({
      mode: body.mode,
      originNode: from,
      destinationNode: to,
      serviceability: body.serviceability as string,
      isActive: body.isActive !== false,
    });
    if (!serviceability.allowed) throw new ConflictException(serviceability.blockers[0]);
    const mode = (serviceability.mode ?? assertV0DomesticMovementMode(body.mode)) as Mode;
    const row = await this.db().laneMaster.create({
      data: {
        tenant_id: tenantId,
        from_facility_code: from,
        to_facility_code: to,
        mode,
        lane_class: asLaneClass(body.laneClass ?? body.lane_class),
        priority: Number(body.priority ?? 1),
        tat_minutes: optionalInt(body.tatMinutes ?? body.tat_minutes),
        is_active: body.isActive !== false,
        effective_from: body.effectiveFrom ? new Date(String(body.effectiveFrom)) : new Date(),
        cutoff_hhmm: optionalText(body.cutoff) ?? optionalText(body.cutoff_hhmm),
        handler_party_code: optionalText(body.handlerPartyCode),
        vendor_party_code: optionalText(body.vendorPartyCode),
        business_type_applicability: optionalText(body.businessType),
        service_product: optionalText(body.serviceProduct),
        serviceability: optionalText(body.serviceability) ?? 'SERVICEABLE',
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'lane.upserted.v1', sourceRecordType: 'LaneMaster', sourceRecordId: row.id, payload: { mode, from, to } });
    return row;
  }

  async listLanes(tenantId: string) {
    const rows = await this.db().laneMaster.findMany({ where: { tenant_id: tenantId } });
    return rows.filter((row: { mode: string }) => {
      try { assertV0DomesticMovementMode(row.mode); return true; } catch { return false; }
    });
  }

  async captureAirportProof(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const proofKind = String(body.proofKind ?? '');
    if (proofKind !== 'ORIGIN_LODGEMENT' && proofKind !== 'DESTINATION_RETRIEVAL') throw new ConflictException('INVALID_AIRPORT_PROOF_KIND');
    const row = await this.db().airportOperationalProof.create({
      data: {
        tenantId,
        proofKind,
        shipmentId: String(body.shipmentId),
        airportCode: String(body.airportCode),
        movementRef: optionalText(body.movementRef),
        lodgementRef: optionalText(body.lodgementRef) ?? optionalText(body.retrievalRef),
        evidenceRef: optionalText(body.evidenceRef),
        conditionStatus: optionalText(body.conditionStatus),
        exceptionId: optionalText(body.exceptionId),
        responsibleParty: optionalText(body.responsibleParty),
        actorId,
        status: String(body.status ?? 'COMPLETED'),
        occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : new Date(),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: `airport.${proofKind.toLowerCase()}.v1`, sourceRecordType: 'AirportOperationalProof', sourceRecordId: row.id, payload: body });
    return row;
  }

  async captureHandoverProof(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const evidenceRef = String(body.evidenceRef ?? '');
    if (!evidenceRef) throw new ConflictException('HANDOVER_EVIDENCE_REQUIRED');
    const gate = evaluateHandoverProofGate({ required: true, proofPresent: true, evidenceRef, kind: body.kind as 'SCAN' | 'PHOTO' | 'SIGNATURE' | 'REFERENCE' | 'DOCUMENT' | null });
    if (!gate.allowed) throw new ConflictException(gate.blockers[0]);
    const row = await this.db().domesticHandoverProof.create({
      data: {
        tenantId,
        shipmentId: String(body.shipmentId),
        bagId: optionalText(body.bagId),
        kind: String(body.kind ?? 'REFERENCE'),
        evidenceRef,
        handoverFrom: optionalText(body.handoverFrom),
        handoverTo: optionalText(body.handoverTo),
        locationRef: optionalText(body.locationRef),
        conditionStatus: optionalText(body.conditionStatus),
        exceptionId: optionalText(body.exceptionId),
        actorId,
        occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : new Date(),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'handover.proof.captured.v1', sourceRecordType: 'DomesticHandoverProof', sourceRecordId: row.id, payload: body });
    return row;
  }

  async generateLoadSheet(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const manifestId = String(body.manifestId ?? '');
    if (!manifestId) throw new ConflictException('MANIFEST_ID_REQUIRED');
    const payload = {
      manifestId,
      shipmentRefs: body.shipmentRefs ?? [],
      bagRefs: body.bagRefs ?? [],
      partyRefs: body.partyRefs ?? [],
      counts: body.counts ?? {},
      weights: body.weights ?? {},
      origin: body.origin ?? null,
      destination: body.destination ?? null,
      mode: body.mode ? assertV0DomesticMovementMode(body.mode) : null,
      lane: body.lane ?? null,
      handler: body.handler ?? null,
      dispatchRef: body.dispatchRef ?? null,
    };
    const loadSheetCode = `LS-${Date.now().toString(36).toUpperCase()}`;
    const row = await this.db().loadSheet.create({
      data: { tenantId, loadSheetCode, manifestId, payloadJson: optionalJson(payload) ?? {}, status: 'GENERATED', createdBy: actorId },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'load_sheet.generated.v1', sourceRecordType: 'LoadSheet', sourceRecordId: row.id, payload });
    return { ...row, downloadRepresentation: { format: 'JSON', payload } };
  }

  async getLoadSheet(tenantId: string, id: string) {
    return this.assertTenantBound(await this.db().loadSheet.findFirst({ where: { id, tenantId } }), tenantId, 'LoadSheet');
  }

  async upsertAirportTask(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const taskKind = String(body.taskKind ?? '');
    if (taskKind !== 'ORIGIN_LODGEMENT' && taskKind !== 'DESTINATION_RETRIEVAL') throw new ConflictException('INVALID_AIRPORT_TASK_KIND');
    const row = await this.db().airportStaffTask.create({
      data: {
        tenantId, taskKind,
        shipmentId: String(body.shipmentId),
        airportCode: String(body.airportCode),
        movementRef: optionalText(body.movementRef),
        assignedRole: optionalText(body.assignedRole) ?? (taskKind === 'ORIGIN_LODGEMENT' ? 'AIRPORT_LODGEMENT_OWNER' : 'AIRPORT_RETRIEVAL_OWNER'),
        assignedUserId: optionalText(body.assignedUserId),
        status: String(body.status ?? 'ASSIGNED'),
        dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'airport.task.created.v1', sourceRecordType: 'AirportStaffTask', sourceRecordId: row.id, payload: body });
    return row;
  }

  async listAirportTasks(tenantId: string, taskKind?: string) {
    return this.db().airportStaffTask.findMany({ where: { tenantId, ...(taskKind ? { taskKind } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async completeAirportTask(tenantId: string, actorId: string, id: string, body: Record<string, unknown>) {
    const task = this.assertTenantBound(await this.db().airportStaffTask.findFirst({ where: { id, tenantId } }), tenantId, 'AirportStaffTask');
    const proof = await this.captureAirportProof(tenantId, actorId, {
      proofKind: task.taskKind,
      shipmentId: task.shipmentId,
      airportCode: task.airportCode,
      movementRef: task.movementRef,
      evidenceRef: body.evidenceRef,
      status: 'COMPLETED',
    });
    const row = await this.db().airportStaffTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', proofId: proof.id } });
    return { task: row, proof };
  }

  async persistHubScan(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const scanValue = String(body.scanValue ?? body.identifier ?? '');
    if (!scanValue) throw new ConflictException('SCAN_OR_MANUAL_IDENTIFIER_REQUIRED');
    const existing = await this.prisma.hubInboundScan.findFirst({ where: { tenantId, barcodeValue: scanValue } });
    if (existing) {
      this.assertTenantBound(existing, tenantId, 'HubInboundScan');
      return { duplicate: true, record: existing, result: 'DUPLICATE' };
    }
    const unexpected = String(body.result ?? 'EXPECTED') === 'UNEXPECTED';
    const record = await this.prisma.hubInboundScan.create({
      data: {
        tenantId,
        hubId: String(body.facilityId ?? body.hubId ?? 'HUB'),
        manifestRef: optionalText(body.manifestRef),
        shipmentRef: String(body.shipmentId ?? body.bagId ?? scanValue),
        scanType: String(body.scanKind ?? 'HUB_RECEIPT'),
        scannedBy: actorId,
        scannedAt: new Date(),
        barcodeValue: scanValue,
        conditionStatus: unexpected ? 'UNEXPECTED' : String(body.conditionStatus ?? 'OK'),
        discrepancyNote: unexpected ? 'UNEXPECTED_SCAN' : null,
        photoRef: optionalText(body.evidenceRef),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'hub.scan.persisted.v1', sourceRecordType: 'HubInboundScan', sourceRecordId: record.id, payload: { scanValue, unexpected } });
    return { duplicate: false, record, result: unexpected ? 'UNEXPECTED' : 'EXPECTED' };
  }

  async persistPickupReceipt(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const awbNumber = String(body.awbNumber ?? body.shipmentId ?? '');
    if (!awbNumber) throw new ConflictException('PICKUP_IDENTIFIER_REQUIRED');
    const existing = await this.prisma.pickup.findFirst({ where: { tenantId, shipmentId: awbNumber } });
    const record = existing
      ? await this.prisma.pickup.update({
        where: { id: this.assertTenantBound(existing, tenantId, 'Pickup').id },
        data: {
          status: 'PICKED_UP',
          pickedAt: new Date(),
          assignedRiderId: actorId,
          specialInstructions: String(body.condition ?? body.pickupNotes ?? ''),
        },
      })
      : await this.prisma.pickup.create({
        data: {
          tenantId,
          shipmentId: awbNumber,
          status: 'PICKED_UP',
          pickedAt: new Date(),
          assignedRiderId: actorId,
          specialInstructions: String(body.condition ?? body.pickupNotes ?? ''),
          pickupAddress: { pieces: Number(body.pieces ?? 1), actualWeightKg: Number(body.actualWeightKg ?? 0), evidenceRef: optionalText(body.evidenceRef) ?? optionalText(body.pickupPhoto) },
        },
      });
    await this.auditChange({ tenantId, actorId, eventName: 'pickup.receipt.persisted.v1', sourceRecordType: 'Pickup', sourceRecordId: record.id, payload: { awbNumber } });
    return record;
  }

  async transitionBag(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const bagCode = String(body.bagCode ?? body.bagId ?? '');
    if (!bagCode) throw new ConflictException('BAG_REFERENCE_REQUIRED');
    const existing = await this.prisma.hubBagRecord.findFirst({ where: { tenantId, OR: [{ id: bagCode }, { bagCode }] } });
    const current = String(existing?.status ?? body.currentStatus ?? 'CREATED') as BagLifecycleStatus;
    const next = nextBagLifecycleStatus(
      current === 'OPEN' || current === 'CREATED' ? current : (current as BagLifecycleStatus),
      String(body.action ?? 'ADD_PIECE') as 'ADD_PIECE' | 'SEAL' | 'CLOSE' | 'MANIFEST' | 'DISPATCH' | 'ARRIVE' | 'DEBAG' | 'EXCEPTION',
    );
    if (existing) {
      this.assertTenantBound(existing, tenantId, 'HubBagRecord');
      if (body.attemptedOwnerTenantId && body.attemptedOwnerTenantId !== tenantId) {
        throw new ForbiddenException('COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED');
      }
      const row = await this.prisma.hubBagRecord.update({
        where: { id: existing.id },
        data: {
          status: next,
          shipmentCount: Number(body.pieceCount ?? existing.shipmentCount ?? 0),
          totalWeightKg: optionalDecimal(body.weightTotal) ?? existing.totalWeightKg,
          linehaulRef: optionalText(body.manifestId) ?? existing.linehaulRef,
        },
      });
      await this.auditChange({ tenantId, actorId, eventName: 'bag.lifecycle.transitioned.v1', sourceRecordType: 'HubBagRecord', sourceRecordId: row.id, payload: { current, next } });
      return { current, next, record: row, bagOwnerRule: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED' };
    }
    const row = await this.prisma.hubBagRecord.create({
      data: {
        tenantId,
        hubId: String(body.origin ?? body.hubId ?? 'HUB'),
        bagCode,
        sealNumber: String(body.sealNumber ?? `SEAL-${bagCode}`),
        destinationHub: String(body.destination ?? 'DEST'),
        shipmentCount: Number(body.pieceCount ?? 0),
        shipmentRefsJson: optionalJson(body.shipmentRefs) ?? [],
        totalWeightKg: optionalDecimal(body.weightTotal),
        baggedBy: actorId,
        baggedAt: new Date(),
        status: next,
        linehaulRef: optionalText(body.manifestId),
      },
    });
    await this.auditChange({ tenantId, actorId, eventName: 'bag.lifecycle.created.v1', sourceRecordType: 'HubBagRecord', sourceRecordId: row.id, payload: { current, next } });
    return { current, next, record: row, bagOwnerRule: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED' };
  }

  deriveOwner(body: Record<string, unknown>) {
    if (!isV0RuntimeExceptionType(body.exceptionType)) throw new ConflictException('INVALID_EXCEPTION_TYPE');
    return deriveExceptionOwner({
      operatorType: body.operatorType as string,
      bookingConfig: body.bookingConfig as CoLoaderConfig,
      custodyState: body.custodyState as string,
      exceptionType: String(body.exceptionType),
      side: body.side as 'ORIGIN' | 'DESTINATION' | 'IN_NETWORK' | null,
      facilityKind: body.facilityKind as string,
    });
  }

  async createOperationalException(tenantId: string, actorId: string, body: Record<string, unknown>) {
    if (!isV0RuntimeExceptionType(body.exceptionType)) throw new ConflictException('INVALID_EXCEPTION_TYPE');
    const ownership = this.deriveOwner(body);
    const shipmentId = String(body.shipmentId ?? '');
    if (!shipmentId) throw new ConflictException('EXCEPTION_SHIPMENT_REQUIRED');
    const row = await this.prisma.shipmentException.create({
      data: {
        tenantId,
        shipmentId,
        exceptionType: String(body.exceptionType),
        severity: String(body.severity ?? 'MEDIUM'),
        currentState: 'DETECTED',
        openedAt: new Date(),
        openedBy: actorId,
        correlationId: `exc_${Date.now()}_${shipmentId}`,
        resolutionNotes: `ownerRole=${ownership.ownerRole};ownerParty=${ownership.ownerParty};reason=${ownership.reason}`,
      },
    });
    await this.auditChange({
      tenantId, actorId, eventName: 'exception.opened.v1',
      sourceRecordType: 'ShipmentException', sourceRecordId: row.id,
      payload: { exceptionType: body.exceptionType, ownership },
    });
    return { exception: row, ownership };
  }

  async productizeCoLoaderFlow(tenantId: string, actorId: string, body: Record<string, unknown>) {
    return this.runAuthoritativeCoLoaderChain(tenantId, actorId, body);
  }

  async runAuthoritativeCoLoaderChain(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const config = String(body.config ?? '') as CoLoaderConfig;
    if (!(Object.values(CO_LOADER_CONFIG) as string[]).includes(config) || config === CO_LOADER_CONFIG.NOT_APPLICABLE) {
      throw new ConflictException('VALID_COLOADER_CONFIG_REQUIRED');
    }
    const shipments = this.shipments;
    const coloader = this.coloader;
    const finance = this.finance;
    const logistics = this.logistics;
    const payables = this.payables;
    if (!shipments || !coloader || !finance || !logistics || !payables) {
      throw new ConflictException('AUTHORITATIVE_DOMAIN_SERVICES_REQUIRED');
    }
    const plan = productizeCoLoaderFlowPlan(config);
    const originAirport = body.originAirport ? String(body.originAirport) : null;
    const destinationAirport = body.destinationAirport ? String(body.destinationAirport) : null;
    const shipmentId = String(body.shipmentId ?? `SHP-${config}-${Date.now().toString(36).toUpperCase()}`);
    const origin = {
      street: String(body.originStreet ?? 'Origin'),
      city: String(body.originCity ?? 'Mumbai'),
      postalCode: String(body.originPostalCode ?? '400001'),
      country: 'IN',
    };
    const destination = {
      street: String(body.destinationStreet ?? 'Destination'),
      city: String(body.destinationCity ?? 'Delhi'),
      postalCode: String(body.destinationPostalCode ?? '110001'),
      country: 'IN',
    };
    const correlationId = `v0_coloader_${config}_${shipmentId}`;
    const booking = await shipments.create(tenantId, {
      tenantId, shipmentId, origin, destination,
      metadata: { shipmentCategory: 'DOMESTIC_COLOADER', coLoaderConfig: config },
    }, correlationId);
    const persisted = await this.prisma.shipment.findFirst({ where: { tenant_id: tenantId, shipment_id: shipmentId } });
    if (persisted) {
      await this.prisma.shipment.update({
        where: { id: persisted.id },
        data: { shipmentCategory: 'DOMESTIC_COLOADER' },
      });
    }
    const counterparties = await this.listCounterparties(tenantId);
    if (body.requireCounterparty === true && counterparties.length === 0) {
      throw new ConflictException('COUNTERPARTY_REQUIRED_FOR_COLOADER_FLOW');
    }
    const responsibility = await coloader.upsertForShipment(
      tenantId,
      shipmentId,
      { coLoaderConfig: config, originAirport: originAirport ?? undefined, destinationAirport: destinationAirport ?? undefined },
      correlationId,
    );
    const bag = await this.transitionBag(tenantId, actorId, {
      bagCode: String(body.bagCode ?? `BAG-${shipmentId}`),
      action: 'ADD_PIECE',
      origin: origin.city,
      destination: destination.city,
      pieceCount: body.pieceCount ?? 1,
    });
    const pickup = await this.persistPickupReceipt(tenantId, actorId, { awbNumber: shipmentId, pieces: body.pieceCount ?? 1, condition: 'GOOD' });
    const manifest = await logistics.createManifest({
      tenantId,
      manifestType: 'COLOADER',
      originFacility: origin.city,
      destinationFacility: destination.city,
      shipmentIds: [shipmentId],
    });
    const loadSheet = await this.generateLoadSheet(tenantId, actorId, {
      manifestId: manifest.id ?? manifest.manifestCode,
      shipmentRefs: [shipmentId],
      bagRefs: [bag.record?.bagCode ?? shipmentId],
      mode: body.mode ?? 'AIR',
      origin: origin.city,
      destination: destination.city,
      handler: responsibility.airportLodgementResponsibleParty,
    });
    const mode = String(body.mode ?? 'AIR');
    const masterReference = String(body.masterReference ?? `MAWB-${shipmentId}`);
    const movementEvidenceRef = String(body.movementEvidenceRef ?? `EV-MAWB-${shipmentId}`);
    const movement = this.movement
      ? {
        mapping: await this.movement.createAirMawbMapping(
          tenantId,
          { mawbReference: masterReference, evidenceRef: movementEvidenceRef, shipmentId },
          { actorId },
          correlationId,
        ),
        link: await this.movement.upsertLink(
          tenantId,
          {
            mode,
            masterReference,
            evidenceRef: movementEvidenceRef,
            shipmentId,
            airMawbReference: masterReference,
            hubBagRecordId: bag.record?.id,
          },
          { actorId },
          correlationId,
        ),
      }
      : { skipped: 'MOVEMENT_MASTER_SERVICE_REQUIRED' };
    const billing = await finance.createInvoiceAndReceivableForBilling({
      tx: this.prisma,
      tenantId,
      shipmentInternalId: persisted?.id ?? shipmentId,
      shipmentBusinessId: shipmentId,
      invoiceAmount: String(body.invoiceAmount ?? '100.00'),
      currency: 'INR',
      correlationId,
      occurredAt: new Date(),
      shipmentStatus: 'CREATED',
      podPresent: false,
    });
    const payable = await payables.create(tenantId, {
      vendorName: String(body.vendorName ?? 'Co-loader'),
      outstandingAmount: Number(body.payableAmount ?? 40),
      status: 'OPEN',
      sourceShipmentId: shipmentId,
    });
    const originTask = originAirport
      ? await this.upsertAirportTask(tenantId, actorId, { taskKind: 'ORIGIN_LODGEMENT', shipmentId, airportCode: originAirport })
      : null;
    const destinationTask = destinationAirport
      ? await this.upsertAirportTask(tenantId, actorId, { taskKind: 'DESTINATION_RETRIEVAL', shipmentId, airportCode: destinationAirport })
      : null;
    const reporting = await finance.getFinanceSummary(tenantId, correlationId);
    await this.auditChange({
      tenantId, actorId, eventName: 'coloader.flow.productized.v1',
      sourceRecordType: 'Shipment', sourceRecordId: shipmentId,
      payload: { config, booking, responsibility, billing: billing.invoiceBusinessId, payableId: payable.id, aiRequired: false },
    });
    return {
      tenantId,
      shipmentId,
      config,
      shipmentCategory: 'DOMESTIC_COLOADER',
      booking,
      validation: { shipmentCategory: 'DOMESTIC_COLOADER', config, responsibility },
      responsibility,
      bag,
      pickup,
      manifest,
      loadSheet,
      movement,
      billing,
      payable,
      reporting,
      originTask,
      destinationTask,
      bagOwnerRule: plan.bagOwnerRule,
      aiRequired: false,
    };
  }

  async gstInvoiceReady(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const invoiceRef = String(body.invoiceId ?? '');
    if (!invoiceRef) throw new ConflictException('INVOICE_ID_REQUIRED');
    const invoice = this.assertTenantBound(
      await this.prisma.invoice.findFirst({ where: { OR: [{ id: invoiceRef }, { invoice_id: invoiceRef }] } }),
      tenantId,
      'Invoice',
    );
    const taxableValue = Number(body.taxableValue ?? invoice.total_amount ?? 0);
    const taxRatePct = Number(body.taxRatePct ?? 18);
    const tax = computeTax({
      base_amount: taxableValue,
      tax_rate_pct: taxRatePct,
      jurisdiction: String(body.jurisdiction ?? 'IN'),
      is_igst: body.isIgst === true,
    });
    const output = buildGstInvoiceReadyOutput({
      tenantId,
      invoiceId: invoice.invoice_id,
      invoiceDate: String(body.invoiceDate ?? invoice.issued_at?.toISOString?.()?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)),
      supplierLegalName: String(body.supplierLegalName ?? ''),
      supplierGstin: body.supplierGstin as string,
      recipientLegalName: String(body.recipientLegalName ?? ''),
      recipientGstin: body.recipientGstin as string,
      supplierStateCode: body.supplierStateCode as string,
      recipientStateCode: body.recipientStateCode as string,
      placeOfSupplyStateCode: body.placeOfSupplyStateCode as string,
      lineDescription: String(body.lineDescription ?? `Domestic logistics ${invoice.shipment_id}`),
      hsnSac: body.hsnSac as string,
      taxableValue,
      taxRatePct,
      taxSplit: tax,
      legalReviewRequired: !body.placeOfSupplyStateCode,
    });
    await this.auditChange({ tenantId, actorId, eventName: 'gst.invoice_ready.generated.v1', sourceRecordType: 'Invoice', sourceRecordId: invoice.id, payload: output });
    return {
      ...output,
      sourceInvoiceId: invoice.id,
      sourceInvoiceBusinessId: invoice.invoice_id,
      exportRepresentation: { format: 'GST_INVOICE_READY_JSON', downloadName: `${invoice.invoice_id}.gst.json`, payload: output },
    };
  }

  async exportTally(tenantId: string, actorId: string, body: Record<string, unknown>) {
    const mapping: TallyLedgerMapping = {
      customerLedger: body.customerLedger as string,
      salesLedger: body.salesLedger as string,
      vendorLedger: body.vendorLedger as string,
      expenseLedger: body.expenseLedger as string,
      cgstLedger: body.cgstLedger as string,
      sgstLedger: body.sgstLedger as string,
      utgstLedger: body.utgstLedger as string,
      igstLedger: body.igstLedger as string,
    };
    const invoiceIdsProvided = Array.isArray(body.invoiceIds);
    const payableIdsProvided = Array.isArray(body.payableIds);
    const requestedInvoiceIds = invoiceIdsProvided ? (body.invoiceIds as unknown[]).map(String) : [];
    const requestedPayableIds = payableIdsProvided ? (body.payableIds as unknown[]).map(String) : [];
    const persistedInvoices = invoiceIdsProvided
      ? await Promise.all(requestedInvoiceIds.map(async (id) => this.assertTenantBound(
        await this.prisma.invoice.findFirst({ where: { OR: [{ id }, { invoice_id: id }] } }),
        tenantId,
        'Invoice',
      )))
      : await this.prisma.invoice.findMany({ where: { tenant_id: tenantId } });
    const listedPayables = this.payables ? await this.payables.list(tenantId) : [];
    const payableRows = payableIdsProvided
      ? requestedPayableIds.map((id) => {
        const row = listedPayables.find((item: Record<string, unknown>) => String(item.id) === id || String(item.vendorInvoiceRef ?? '') === id);
        if (!row) throw new ForbiddenException('CROSS_TENANT_ACCESS_DENIED');
        return row;
      })
      : listedPayables;

    const blockers: string[] = [];
    const vouchers: TallyNativeVoucher[] = [];
    for (const invoice of persistedInvoices) {
      const rating = (invoice.commercial_rating_json ?? {}) as Record<string, unknown>;
      const tax = (body.invoiceTax ?? rating.tax ?? rating.taxSplit) as TallyTaxComponents | undefined;
      const mapped = mapCustomerInvoiceToTallyVoucher({
        tenantId,
        invoiceId: invoice.invoice_id,
        voucherNumber: invoice.invoice_id,
        date: invoice.issued_at?.toISOString?.()?.slice(0, 10) ?? invoice.issued_at,
        customerLedger: String(body.customerLedger ?? rating.customerLedger ?? ''),
        salesLedger: String(body.salesLedger ?? rating.salesLedger ?? ''),
        taxableValue: String(tax?.taxableValue ?? rating.baseAmount ?? invoice.total_amount),
        totalAmount: String(invoice.total_amount),
        tax,
        narration: `NEXOS customer invoice ${invoice.invoice_id}`,
        shipmentId: invoice.shipment_id,
      }, mapping);
      if (!mapped.ok) blockers.push(...mapped.blockers.map((code) => `${invoice.invoice_id}:${code}`));
      else vouchers.push(mapped.voucher);
    }
    for (const payable of payableRows as Array<Record<string, unknown>>) {
      const mapped = mapPayableToTallyVoucher({
        tenantId,
        payableId: String(payable.id),
        voucherNumber: String(payable.vendorInvoiceNumber ?? payable.voucherNumber ?? payable.id),
        date: formatTallyDate(payable.invoiceDate ?? payable.createdAt) || null,
        vendorLedger: String(payable.vendorName ?? payable.vendorRef ?? mapping.vendorLedger ?? ''),
        expenseLedger: String(payable.expenseLedger ?? mapping.expenseLedger ?? ''),
        taxableValue: String(payable.invoiceAmount ?? payable.outstandingAmount ?? payable.amount ?? ''),
        totalAmount: String(payable.outstandingAmount ?? payable.invoiceAmount ?? payable.amount ?? ''),
        tax: (payable.tax ?? body.payableTax) as TallyTaxComponents | undefined,
        status: String(payable.status ?? ''),
        narration: `NEXOS vendor/co-loader payable ${String(payable.id)}`,
        shipmentId: payable.sourceShipmentId ? String(payable.sourceShipmentId) : null,
      }, mapping);
      if (!mapped.ok) blockers.push(...mapped.blockers.map((code) => `${String(payable.id)}:${code}`));
      else vouchers.push(mapped.voucher);
    }
    if (!vouchers.length || blockers.length) {
      return {
        format: TALLY_NATIVE_XML_FORMAT,
        xml: '',
        downloadName: '',
        itemCount: 0,
        sourceIds: [],
        blockers: blockers.length ? blockers : ['TALLY_NO_ELIGIBLE_SOURCE'],
        exportFailed: true,
        genericGlCsvUsed: false,
        billingUnchanged: true,
        payableUnchanged: true,
      };
    }
    const xml = serializeTallyNativeXml(vouchers);
    const structure = validateTallyNativeXmlStructure(xml);
    if (!structure.valid) {
      return {
        format: TALLY_NATIVE_XML_FORMAT,
        xml: '',
        downloadName: '',
        itemCount: 0,
        sourceIds: [],
        blockers: structure.blockers,
        exportFailed: true,
        genericGlCsvUsed: false,
        billingUnchanged: true,
        payableUnchanged: true,
      };
    }
    const exportCode = `TLY-${Date.now().toString(36).toUpperCase()}`;
    const sourceIds = vouchers.map((row) => row.sourceId);
    const downloadName = tallyNativeXmlDownloadName(exportCode);
    const row = await this.db().tallyExportBatch.create({
      data: {
        tenantId,
        exportCode,
        payloadJson: { format: TALLY_NATIVE_XML_FORMAT, downloadName, itemCount: vouchers.length, sourceIds },
        sourceIds,
        createdBy: actorId,
      },
    });
    await this.auditChange({
      tenantId, actorId, eventName: 'tally.export.generated.v1',
      sourceRecordType: 'TallyExportBatch', sourceRecordId: row.id,
      payload: { format: TALLY_NATIVE_XML_FORMAT, exportCode, itemCount: vouchers.length, sourceIds },
    });
    return {
      ...row,
      format: TALLY_NATIVE_XML_FORMAT,
      formatAuthority: 'Tally native XML voucher import ENVELOPE/HEADER/Import/Data/Vouchers',
      xml,
      downloadName,
      itemCount: vouchers.length,
      sourceIds,
      blockers: [],
      exportFailed: false,
      genericGlCsvUsed: false,
      billingUnchanged: true,
      payableUnchanged: true,
    };
  }

  aiDisabledCoreProof() {
    return { aiRequired: false, externalApiRequired: false, note: 'Use executeAiDisabledCorePack() to exercise real domain seams.' };
  }

  async executeAiDisabledCorePack(tenantId: string, actorId: string) {
    const isolation = this.evaluateIsolation(tenantId, tenantId);
    const party = await this.upsertCounterparty(tenantId, actorId, { partyType: 'CUSTOMER_PARTY', partyCode: 'CORE-PTY', legalName: 'Core Party' });
    const employee = await this.createEmployee(tenantId, actorId, { employeeCode: 'CORE-EMP', fullName: 'Core Employee' });
    const attendance = await this.punchAttendance(tenantId, actorId, { employeeRef: employee.employeeCode, action: 'CHECK_IN' });
    const hubScan = await this.persistHubScan(tenantId, actorId, { scanValue: 'CORE-SCAN', facilityId: 'HUB' });
    const pickup = await this.persistPickupReceipt(tenantId, actorId, { awbNumber: 'CORE-AWB', pieces: 1, condition: 'GOOD' });
    const bag = await this.transitionBag(tenantId, actorId, { bagCode: 'CORE-BAG', action: 'ADD_PIECE', origin: 'BOM', destination: 'DEL' });
    const handover = await this.captureHandoverProof(tenantId, actorId, { shipmentId: 'CORE-AWB', evidenceRef: 'CORE-EV', kind: 'REFERENCE' });
    const airport = await this.upsertAirportTask(tenantId, actorId, { taskKind: 'ORIGIN_LODGEMENT', shipmentId: 'CORE-AWB', airportCode: 'BOM' });
    const exception = await this.createOperationalException(tenantId, actorId, {
      exceptionType: 'DELAY',
      shipmentId: 'CORE-AWB',
      bookingConfig: CO_LOADER_CONFIG.PARTY_TO_COLOADER,
      side: 'ORIGIN',
    });
    const coloader = this.shipments && this.coloader && this.finance && this.logistics && this.payables
      ? await this.productizeCoLoaderFlow(tenantId, actorId, {
        config: CO_LOADER_CONFIG.PARTY_TO_PARTY,
        shipmentId: 'CORE-CL',
        originAirport: 'BOM',
        destinationAirport: 'DEL',
        invoiceAmount: '100.00',
      })
      : null;
    const tally = await this.exportTally(tenantId, actorId, {
      customerLedger: 'Core Customer',
      salesLedger: 'Domestic Courier Sales',
      vendorLedger: 'Co-loader',
      expenseLedger: 'Co-loader Freight',
    });
    const invoice = await this.prisma.invoice.findFirst({ where: { tenant_id: tenantId } });
    const gst = invoice
      ? await this.gstInvoiceReady(tenantId, actorId, {
        invoiceId: invoice.invoice_id,
        supplierLegalName: 'Core Supplier',
        recipientLegalName: 'Core Recipient',
      })
      : { skipped: 'NO_INVOICE_RECORD' };
    const epod = this.delivery
      ? await this.delivery.executeDelivery(tenantId, actorId, {
        shipment_internal_id: String(coloader?.shipmentId ?? 'CORE-EPOD'),
        agent_id: actorId,
        delivery_timestamp: new Date().toISOString(),
        receiver_name: 'Core Receiver',
        pod_evidence: [{ type: 'SIGNATURE', value: 'SIG-CORE', captured_at: new Date().toISOString() }],
      })
      : { skipped: 'DELIVERY_SERVICE_REQUIRED' };
    return {
      aiRequired: false,
      isolation,
      party: { id: party.id, tenantId: party.tenantId },
      employee: { id: employee.id, tenantId: employee.tenantId },
      attendance: { action: attendance.action },
      hubScan: { result: hubScan.result },
      pickup: { shipmentId: pickup.shipmentId },
      bag: { bagOwnerRule: bag.bagOwnerRule },
      handover: { evidenceRef: handover.evidenceRef },
      airport: { taskKind: airport.taskKind },
      exception: { exceptionType: exception.exception.exceptionType, ownerRole: exception.ownership.ownerRole },
      coloader: coloader ? { shipmentId: coloader.shipmentId, billing: coloader.billing?.invoiceBusinessId, reporting: Boolean(coloader.reporting), movement: Boolean(coloader.movement), aiRequired: coloader.aiRequired } : null,
      epod: 'outcome' in epod ? { outcome: epod.outcome } : epod,
      tally: { format: tally.format, genericGlCsvUsed: tally.genericGlCsvUsed, exportFailed: tally.exportFailed },
      gst: 'sourceInvoiceBusinessId' in gst ? { sourceInvoiceBusinessId: gst.sourceInvoiceBusinessId, format: gst.exportRepresentation?.format } : gst,
      operationsCovered: ['ISOLATION', 'PARTY', 'EMPLOYEE', 'ATTENDANCE', 'SHIPMENT', 'PICKUP', 'HUB_SCAN', 'BAG', 'MANIFEST', 'LOAD_SHEET', 'COLOADER_FLOW', 'HANDOVER', 'AIRPORT_TASK', 'EPOD', 'BILLING', 'PAYABLE', 'EXCEPTION', 'EXPORT', ...V1_AI_DISABLED_SURFACES],
      v1: this.v1
        ? {
            aiRequired: false,
            surfaces: this.v1.aiDisabledV1Surfaces(),
            attendanceEvaluation: (attendance as { evaluation?: unknown }).evaluation ?? null,
            owner: await this.v1.ownerDashboard(tenantId).catch((err: Error) => ({ error: err.message })),
            courier: await this.v1.courierDashboard(tenantId).catch((err: Error) => ({ error: err.message })),
            coloader: await this.v1.coloaderDashboard(tenantId).catch((err: Error) => ({ error: err.message })),
            credit: await this.v1.creditAdmission(tenantId, actorId, { accountId: 'CORE-PTY', prospectiveBookingExposure: 0 }).catch((err: Error) => ({ error: err.message })),
            margin: await this.v1.marginReadModel(tenantId).catch((err: Error) => ({ error: err.message })),
            alerts: await this.v1.evaluateAlerts(tenantId, actorId, { trigger: 'ABSENT_EMPLOYEE', conditionMet: false }).catch((err: Error) => ({ error: err.message })),
          }
        : { aiRequired: false, surfaces: [...V1_AI_DISABLED_SURFACES], attendanceEvaluation: (attendance as { evaluation?: unknown }).evaluation ?? null },
    };
  }
}
