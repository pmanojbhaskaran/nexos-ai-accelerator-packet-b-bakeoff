import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequireCapability } from '../tenant-config-engine/require-capability.decorator';
import { V0ReadinessService } from './v0-readiness.service';

@Controller('v0')
export class V0ReadinessController {
  constructor(private readonly service: V0ReadinessService) {}

  private tenant(req: Record<string, unknown>): string {
    const user = req.user as Record<string, unknown> | undefined;
    return String(user?.tenantId ?? (req.headers as Record<string, unknown>)?.['x-tenant-id'] ?? '');
  }
  private actor(req: Record<string, unknown>): string {
    const user = req.user as Record<string, unknown> | undefined;
    return String(user?.sub ?? 'SYSTEM');
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('departments')
  upsertDepartment(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertDepartment(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('departments')
  listDepartments(@Req() req: Record<string, unknown>, @Query('status') status?: string) {
    return this.service.listDepartments(this.tenant(req), status);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('departments/seed-defaults')
  seedDepartments(@Req() req: Record<string, unknown>) {
    return this.service.seedDefaultDepartments(this.tenant(req), this.actor(req));
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('designations')
  upsertDesignation(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertDesignation(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('designations')
  listDesignations(@Req() req: Record<string, unknown>, @Query('status') status?: string) {
    return this.service.listDesignations(this.tenant(req), status);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('designations/:id')
  getDesignation(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getDesignation(this.tenant(req), id);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('designations/:id/status')
  setDesignationStatus(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'INACTIVE' }) {
    return this.service.setDesignationStatus(this.tenant(req), this.actor(req), id, body.status);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('departments/:id')
  getDepartment(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getDepartment(this.tenant(req), id);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('departments/:id/status')
  setDepartmentStatus(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'INACTIVE' }) {
    return this.service.setDepartmentStatus(this.tenant(req), this.actor(req), id, body.status);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('facility-nodes')
  listFacilityNodes(@Req() req: Record<string, unknown>) {
    return this.service.listFacilityNodes(this.tenant(req));
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('employees')
  createEmployee(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.createEmployee(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('employees')
  listEmployees(@Req() req: Record<string, unknown>, @Query() query: Record<string, string | undefined>) {
    return this.service.listEmployees(this.tenant(req), query);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('employees/:id')
  getEmployee(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getEmployee(this.tenant(req), id);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Patch('employees/:id')
  updateEmployee(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateEmployee(this.tenant(req), this.actor(req), id, body);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('employees/:id/status')
  setEmployeeStatus(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: { status: 'ACTIVE' | 'INACTIVE' }) {
    return this.service.setEmployeeStatus(this.tenant(req), this.actor(req), id, body.status);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Post('shifts')
  upsertShift(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertShift(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('shifts')
  listShifts(@Req() req: Record<string, unknown>) {
    return this.service.listShifts(this.tenant(req));
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('shifts/:id')
  getShift(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getShift(this.tenant(req), id);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Patch('shifts/:id')
  updateShift(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateShift(this.tenant(req), this.actor(req), id, body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Post('weekly-offs')
  upsertWeeklyOff(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertWeeklyOff(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('weekly-offs')
  listWeeklyOffs(@Req() req: Record<string, unknown>) {
    return this.service.listWeeklyOffs(this.tenant(req));
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('weekly-offs/:id')
  getWeeklyOff(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getWeeklyOff(this.tenant(req), id);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Patch('weekly-offs/:id')
  updateWeeklyOff(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateWeeklyOff(this.tenant(req), this.actor(req), id, body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Post('holidays')
  upsertHoliday(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertHoliday(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('holidays')
  listHolidays(@Req() req: Record<string, unknown>) {
    return this.service.listHolidays(this.tenant(req));
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('holidays/:id')
  getHoliday(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getHoliday(this.tenant(req), id);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Patch('holidays/:id')
  updateHoliday(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateHoliday(this.tenant(req), this.actor(req), id, body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Post('attendance/punch')
  punch(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.punchAttendance(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_ATTENDANCE')
  @Get('attendance/current')
  current(@Req() req: Record<string, unknown>, @Query('employeeRef') employeeRef: string) {
    return this.service.currentAttendance(this.tenant(req), employeeRef);
  }

  @Post('counterparties')
  upsertCounterparty(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertCounterparty(this.tenant(req), this.actor(req), body);
  }

  @Get('counterparties')
  listCounterparties(@Req() req: Record<string, unknown>, @Query('partyType') partyType?: string) {
    return this.service.listCounterparties(this.tenant(req), partyType);
  }

  @Get('counterparties/:id')
  getCounterparty(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getCounterparty(this.tenant(req), id);
  }

  @Patch('counterparties/:id')
  updateCounterparty(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateCounterparty(this.tenant(req), this.actor(req), id, body);
  }

  @Post('lanes')
  upsertLane(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertLane(this.tenant(req), this.actor(req), body);
  }

  @Get('lanes')
  listLanes(@Req() req: Record<string, unknown>) {
    return this.service.listLanes(this.tenant(req));
  }

  @Post('airport-proofs')
  captureAirportProof(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.captureAirportProof(this.tenant(req), this.actor(req), body);
  }

  @Post('handover-proofs')
  captureHandover(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.captureHandoverProof(this.tenant(req), this.actor(req), body);
  }

  @Post('load-sheets')
  generateLoadSheet(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.generateLoadSheet(this.tenant(req), this.actor(req), body);
  }

  @Get('load-sheets/:id')
  getLoadSheet(@Req() req: Record<string, unknown>, @Param('id') id: string) {
    return this.service.getLoadSheet(this.tenant(req), id);
  }

  @Post('airport-tasks')
  createAirportTask(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertAirportTask(this.tenant(req), this.actor(req), body);
  }

  @Get('airport-tasks')
  listAirportTasks(@Req() req: Record<string, unknown>, @Query('taskKind') taskKind?: string) {
    return this.service.listAirportTasks(this.tenant(req), taskKind);
  }

  @Post('airport-tasks/:id/complete')
  completeAirportTask(@Req() req: Record<string, unknown>, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.completeAirportTask(this.tenant(req), this.actor(req), id, body);
  }

  @Post('hub-scans')
  hubScan(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.persistHubScan(this.tenant(req), this.actor(req), body);
  }

  @Post('pickup-receipts')
  pickup(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.persistPickupReceipt(this.tenant(req), this.actor(req), body);
  }

  @Post('bags/transition')
  bagTransition(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.transitionBag(this.tenant(req), this.actor(req), body);
  }

  @Post('exceptions/owner')
  deriveOwner(@Body() body: Record<string, unknown>) {
    return this.service.deriveOwner(body);
  }

  @Post('exceptions')
  createException(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.createOperationalException(this.tenant(req), this.actor(req), body);
  }

  @Post('coloader-flows/:config')
  productizeFlow(@Req() req: Record<string, unknown>, @Param('config') config: string, @Body() body: Record<string, unknown>) {
    return this.service.productizeCoLoaderFlow(this.tenant(req), this.actor(req), { ...body, config });
  }

  @Post('finance/gst-invoice-ready')
  gstInvoice(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.gstInvoiceReady(this.tenant(req), this.actor(req), body);
  }

  @Post('finance/tally-export')
  tallyExport(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.exportTally(this.tenant(req), this.actor(req), body);
  }

  @Get('ai-disabled-core')
  aiDisabled() {
    return this.service.aiDisabledCoreProof();
  }

  @Post('ai-disabled-core-pack')
  executeAiDisabledCorePack(@Req() req: Record<string, unknown>) {
    return this.service.executeAiDisabledCorePack(this.tenant(req), this.actor(req));
  }
}

@Controller('saas/organization')
export class V0OrganizationAliasController {
  constructor(private readonly service: V0ReadinessService) {}
  private tenant(req: Record<string, unknown>): string {
    const user = req.user as Record<string, unknown> | undefined;
    return String(user?.tenantId ?? (req.headers as Record<string, unknown>)?.['x-tenant-id'] ?? '');
  }
  private actor(req: Record<string, unknown>): string {
    const user = req.user as Record<string, unknown> | undefined;
    return String(user?.sub ?? 'SYSTEM');
  }

  @RequireCapability('HR_EMPLOYEES')
  @Post('departments')
  upsert(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    return this.service.upsertOrganizationDepartments(this.tenant(req), this.actor(req), body);
  }

  @RequireCapability('HR_EMPLOYEES')
  @Get('departments')
  list(@Req() req: Record<string, unknown>) {
    return this.service.listDepartments(this.tenant(req));
  }
}
