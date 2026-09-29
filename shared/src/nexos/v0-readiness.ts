/**
 * NEXOS V0 readiness contracts and deterministic rules.
 * PACKET_ID=NEXOS_V0_COMPLETE_SOURCE_GAP_CLOSURE_MASTER_PACKET
 * No AI. No external API. Tenant-owned copies only.
 */

import {
  CO_LOADER_CONFIG,
  deriveCoLoaderResponsibility,
  type CoLoaderConfig,
} from './coloader-booking-config';

export const V0_DOMESTIC_MOVEMENT_MODES = ['AIR', 'ROAD', 'RAIL'] as const;
export type V0DomesticMovementMode = (typeof V0_DOMESTIC_MOVEMENT_MODES)[number];

export const V0_PARKED_MOVEMENT_MODES = ['SEA'] as const;

export function isV0DomesticMovementMode(value: unknown): value is V0DomesticMovementMode {
  return typeof value === 'string' && (V0_DOMESTIC_MOVEMENT_MODES as readonly string[]).includes(value);
}

export function normalizeDomesticMovementMode(value: unknown): V0DomesticMovementMode | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toUpperCase();
  if (raw === 'AIR') return 'AIR';
  if (raw === 'ROAD' || raw === 'SURFACE' || raw === 'SURFACE_ROAD') return 'ROAD';
  if (raw === 'RAIL' || raw === 'SURFACE_RAIL') return 'RAIL';
  if (raw === 'SEA' || raw === 'OCEAN' || raw === 'INTERNATIONAL_SEA') return null;
  return null;
}

export function evaluateLaneServiceability(input: {
  mode: unknown;
  originNode?: string | null;
  destinationNode?: string | null;
  serviceability?: string | null;
  isActive?: boolean | null;
}): { allowed: boolean; blockers: string[]; mode?: V0DomesticMovementMode } {
  const blockers: string[] = [];
  let mode: V0DomesticMovementMode | undefined;
  try {
    mode = assertV0DomesticMovementMode(input.mode);
  } catch {
    blockers.push('LANE_MODE_NOT_V0_DOMESTIC');
  }
  if (!String(input.originNode ?? '').trim() || !String(input.destinationNode ?? '').trim()) {
    blockers.push('LANE_OD_REQUIRED');
  }
  if (input.isActive === false || String(input.serviceability ?? 'SERVICEABLE').toUpperCase() === 'UNSERVICEABLE') {
    blockers.push('LANE_NOT_SERVICEABLE');
  }
  return { allowed: blockers.length === 0, blockers, mode };
}

export function assertV0DomesticMovementMode(value: unknown): V0DomesticMovementMode {
  const mode = normalizeDomesticMovementMode(value);
  if (!mode) {
    throw new Error(
      `V0 domestic movement mode must be AIR, ROAD/SURFACE, or RAIL. SEA and international modes are not active.`,
    );
  }
  return mode;
}

export const V0_COUNTERPARTY_TYPES = [
  'COURIER_COMPANY',
  'CO_LOADER',
  'CUSTOMER_PARTY',
  'VENDOR',
  'AGENT',
  'AIRPORT_HANDLER',
  'RAIL_HANDLER',
  'ROAD_VENDOR',
  'OTHER',
] as const;
export type V0CounterpartyType = (typeof V0_COUNTERPARTY_TYPES)[number];

export function isV0CounterpartyType(value: unknown): value is V0CounterpartyType {
  return typeof value === 'string' && (V0_COUNTERPARTY_TYPES as readonly string[]).includes(value);
}

export const V0_EMPLOYEE_DEPARTMENT_CODES = [
  'OPERATIONS',
  'HUB',
  'AIRPORT',
  'PICKUP',
  'DELIVERY',
  'HR',
  'FINANCE',
  'SALES',
  'CUSTOMER_SERVICE',
  'ADMIN',
  'MANAGEMENT',
] as const;

export const V0_REQUIRED_EXCEPTION_TYPES = [
  'SHORT',
  'EXCESS',
  'DAMAGE',
  'MISROUTE',
  'OFFLOAD',
  'DELAY',
  'MISSING_PROOF',
] as const;
export type V0RequiredExceptionType = (typeof V0_REQUIRED_EXCEPTION_TYPES)[number];

export const V0_PRESERVED_EXCEPTION_TYPES = [
  'NDR',
  'RTO',
  'MNR',
  'RETENTION',
  'RTS',
  'REGULATORY_HOLD',
  'FINANCIAL_HOLD',
  'DELAY_RISK',
  'DOC_MISSING',
  'PACKAGING_NC',
  'CUSTODY_BREAK',
  'TEMP_EXCURSION',
  'LOCATION_DEVIATION',
  'MISSED_CONNECTION',
  'PROOF_FAILURE',
  'PRICING_BREACH',
  'LANE_FAILURE',
] as const;

export const V0_RUNTIME_EXCEPTION_TYPES = [
  ...V0_PRESERVED_EXCEPTION_TYPES,
  ...V0_REQUIRED_EXCEPTION_TYPES,
] as const;
export type V0RuntimeExceptionType = (typeof V0_RUNTIME_EXCEPTION_TYPES)[number];

export function isV0RuntimeExceptionType(value: unknown): value is V0RuntimeExceptionType {
  return typeof value === 'string' && (V0_RUNTIME_EXCEPTION_TYPES as readonly string[]).includes(value);
}

export const V0_LATER_RELEASE_CAPABILITIES = [
  'HR_PAYROLL',
  'INTERNATIONAL_SEA',
  'SEA_FREIGHT',
  'CUSTOMS_AUTOMATION',
  'DG_IATA_OPS',
] as const;

export const V0_LATER_RELEASE_WEB_PATHS = [
  '/hr-depth/payroll',
  '/hr-workforce',
  '/dg-management',
  '/platform/logistics/dg-eligibility',
  '/waybill-iata-imdg-docs',
  '/product/freight-transport',
] as const;

export const V0_LATER_RELEASE_API_PREFIXES = [
  '/hr-depth/payroll',
  '/hr/payroll',
  '/hr/attendance',
  '/hrms-ops/payroll-run',
  '/hr-workforce/payslips',
  '/hr-workforce/payroll-runs',
  '/hr-workforce/salary-structures',
  '/dg-management',
  '/platform/logistics/dg-eligibility',
  '/waybill-iata-imdg',
  '/international-air',
  '/sea-freight',
  '/customs-automation',
  '/ai',
] as const;

export function isLaterReleaseCapability(code: unknown): boolean {
  return typeof code === 'string' && (V0_LATER_RELEASE_CAPABILITIES as readonly string[]).includes(code);
}

export function isLaterReleaseWebPath(pathname: string): boolean {
  const path = pathname.split('?')[0].toLowerCase();
  return V0_LATER_RELEASE_WEB_PATHS.some((blocked) => path === blocked || path.startsWith(`${blocked}/`));
}

export const V0_DOMESTIC_AIR_ALLOW_API_PREFIXES = [
  '/v0/airport-tasks',
  '/v0/airport-proofs',
  '/v0/lanes',
] as const;

export function isDomesticAirAllowApiPath(pathname: string): boolean {
  const raw = pathname.split('?')[0].toLowerCase();
  const path = raw.replace(/^\/api(?=\/)/, '');
  return V0_DOMESTIC_AIR_ALLOW_API_PREFIXES.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

export function isLaterReleaseApiPath(pathname: string): boolean {
  const raw = pathname.split('?')[0].toLowerCase();
  const path = raw.replace(/^\/api(?=\/)/, '');
  if (isDomesticAirAllowApiPath(path)) return false;
  return V0_LATER_RELEASE_API_PREFIXES.some((blocked) => path === blocked || path.startsWith(`${blocked}/`));
}

export function evaluateLaterReleaseGuard(input: {
  capabilityCode?: string | null;
  webPath?: string | null;
  apiPath?: string | null;
}): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (input.capabilityCode && isLaterReleaseCapability(input.capabilityCode)) {
    blockers.push(`LATER_RELEASE_CAPABILITY_BLOCKED:${input.capabilityCode}`);
  }
  if (input.webPath && isLaterReleaseWebPath(input.webPath)) {
    blockers.push(`LATER_RELEASE_WEB_PATH_BLOCKED:${input.webPath}`);
  }
  if (input.apiPath && isLaterReleaseApiPath(input.apiPath)) {
    blockers.push(`LATER_RELEASE_API_PATH_BLOCKED:${input.apiPath}`);
  }
  return { allowed: blockers.length === 0, blockers };
}

export const V0_PAYROLL_EXPOSURE_TOKENS = [
  'payroll-run',
  'payslip',
  'salary-structure',
  'salaryStructure',
  'pf/esi',
  'statutory payroll',
] as const;

export function evaluatePayrollExposureGuard(input: {
  capabilityCode?: string | null;
  apiPath?: string | null;
  webPath?: string | null;
}): { allowed: boolean; blockers: string[] } {
  return evaluateLaterReleaseGuard({
    capabilityCode: input.capabilityCode === 'HR_PAYROLL' || input.capabilityCode === 'HR_EMPLOYEES' && input.apiPath?.includes('payroll')
      ? 'HR_PAYROLL'
      : input.capabilityCode,
    apiPath: input.apiPath,
    webPath: input.webPath,
  });
}

export type AirportProofStatus = 'ASSIGNED' | 'READY' | 'COMPLETED' | 'FAILED';
export type HandoverProofKind = 'SCAN' | 'PHOTO' | 'SIGNATURE' | 'REFERENCE' | 'DOCUMENT';
export type BagLifecycleStatus =
  | 'CREATED'
  | 'OPEN'
  | 'SEALED'
  | 'CLOSED'
  | 'MANIFESTED'
  | 'DISPATCHED'
  | 'ARRIVED'
  | 'DEBAGGED'
  | 'EXCEPTION';

export function nextBagLifecycleStatus(
  current: BagLifecycleStatus,
  action: 'ADD_PIECE' | 'SEAL' | 'CLOSE' | 'MANIFEST' | 'DISPATCH' | 'ARRIVE' | 'DEBAG' | 'EXCEPTION',
): BagLifecycleStatus {
  if (action === 'EXCEPTION') return 'EXCEPTION';
  if (action === 'ADD_PIECE' && (current === 'CREATED' || current === 'OPEN')) return 'OPEN';
  if (action === 'SEAL' && (current === 'OPEN' || current === 'CREATED')) return 'SEALED';
  if (action === 'CLOSE' && (current === 'SEALED' || current === 'OPEN' || current === 'CREATED')) return 'CLOSED';
  if (action === 'MANIFEST' && (current === 'CLOSED' || current === 'SEALED')) return 'MANIFESTED';
  if (action === 'DISPATCH' && (current === 'MANIFESTED' || current === 'CLOSED')) return 'DISPATCHED';
  if (action === 'ARRIVE' && current === 'DISPATCHED') return 'ARRIVED';
  if (action === 'DEBAG' && current === 'ARRIVED') return 'DEBAGGED';
  throw new Error(`Invalid bag lifecycle transition ${current} + ${action}`);
}

export type ExceptionOwnerDerivation = {
  ownerRole: string;
  ownerParty: string;
  reason: string;
  escalationOwner: string;
  escalationState: string;
};

function custodyToken(input: {
  custodyState?: string | null;
  movementState?: string | null;
  handler?: string | null;
  currentCustodian?: string | null;
  operatorType?: string | null;
  facilityKind?: string | null;
}): string {
  return [
    input.custodyState,
    input.movementState,
    input.handler,
    input.currentCustodian,
    input.operatorType,
    input.facilityKind,
  ].map((value) => String(value ?? '').toUpperCase()).join(' ');
}

function isLinehaulCustody(token: string): boolean {
  return /LINEHAUL|IN_TRANSIT|IN_MOVEMENT|ON_MOVE|MAWB|ROAD_MASTER|RAIL_MASTER/.test(token);
}

function isHubOrScanCustody(token: string): boolean {
  return /HUB|SCAN|IN_HUB|DEBAG|BAG|WAREHOUSE/.test(token);
}

function withEscalation(
  result: { ownerRole: string; ownerParty: string; reason: string },
  escalationOwner = 'NETWORK_CONTROL',
  escalationState = 'OPEN_ESCALATION_READY',
): ExceptionOwnerDerivation {
  return { ...result, escalationOwner, escalationState };
}

/**
 * CCL-0029 precedence:
 * A. Proof responsibility
 * B. Active linehaul/handler custody
 * C. Booking-configuration origin/destination responsibility
 * D. Hub/scan/count/condition custody
 * E. Operator default
 */
export function deriveExceptionOwner(input: {
  operatorType?: string | null;
  bookingConfig?: CoLoaderConfig | string | null;
  custodyState?: string | null;
  movementState?: string | null;
  handler?: string | null;
  currentCustodian?: string | null;
  exceptionType: string;
  side?: 'ORIGIN' | 'DESTINATION' | 'IN_NETWORK' | null;
  facilityKind?: string | null;
}): ExceptionOwnerDerivation {
  const exceptionType = String(input.exceptionType);
  const config = (input.bookingConfig ?? CO_LOADER_CONFIG.NOT_APPLICABLE) as CoLoaderConfig;
  const side = input.side ?? 'IN_NETWORK';
  const token = custodyToken(input);
  const linehaulCustody = isLinehaulCustody(token);
  const hubCustody = isHubOrScanCustody(token);
  const booking = config !== CO_LOADER_CONFIG.NOT_APPLICABLE ? deriveCoLoaderResponsibility(config) : null;

  if (exceptionType === 'MISSING_PROOF' || exceptionType === 'PROOF_FAILURE') {
    const ownerParty = booking
      ? (side === 'DESTINATION' ? booking.destinationAirportRetrievalResponsibleParty : booking.airportLodgementResponsibleParty)
      : (side === 'DESTINATION' ? 'DESTINATION_HANDLER' : 'ORIGIN_HANDLER');
    return withEscalation({
      ownerRole: 'PROOF_CUSTODIAN',
      ownerParty,
      reason: booking ? `PROOF_FOLLOWS_${side}_BOOKING_${config}` : 'PROOF_EXCEPTION_FOLLOWS_CURRENT_SIDE',
    });
  }

  if (linehaulCustody && (exceptionType === 'DELAY' || exceptionType === 'DELAY_RISK' || exceptionType === 'OFFLOAD')) {
    return withEscalation({
      ownerRole: exceptionType === 'OFFLOAD' ? 'LINEHAUL_HANDLER' : 'SLA_CONTROLLER',
      ownerParty: 'LINEHAUL_OWNER',
      reason: 'ACTIVE_LINEHAUL_CUSTODY_OWNS_MOVEMENT_EXCEPTION',
    }, 'NETWORK_CONTROL', 'OPEN_ESCALATION_READY');
  }

  const facilityException =
    exceptionType === 'SHORT' ||
    exceptionType === 'EXCESS' ||
    exceptionType === 'DAMAGE' ||
    exceptionType === 'OFFLOAD' ||
    exceptionType === 'SCAN_MISMATCH';
  const explicitHandler = Boolean(input.currentCustodian || input.handler || hubCustody);
  if (facilityException && explicitHandler) {
    return withEscalation({
      ownerRole: 'HUB_EXCEPTION_OWNER',
      ownerParty: input.currentCustodian || input.handler || 'CURRENT_CUSTODY',
      reason: 'COUNT_CONDITION_OR_SCAN_FOLLOWS_CURRENT_CUSTODY',
    }, 'NETWORK_CONTROL', 'OPEN_ESCALATION_READY');
  }

  if (booking && (side === 'ORIGIN' || side === 'DESTINATION') && !linehaulCustody && !hubCustody) {
    if (side === 'ORIGIN') {
      return withEscalation({
        ownerRole: 'AIRPORT_LODGEMENT_OWNER',
        ownerParty: booking.airportLodgementResponsibleParty,
        reason: `ORIGIN_SIDE_FOLLOWS_${config}`,
      });
    }
    return withEscalation({
      ownerRole: 'AIRPORT_RETRIEVAL_OWNER',
      ownerParty: booking.destinationAirportRetrievalResponsibleParty,
      reason: `DESTINATION_SIDE_FOLLOWS_${config}`,
    });
  }

  if (facilityException) {
    return withEscalation({
      ownerRole: 'HUB_EXCEPTION_OWNER',
      ownerParty: input.currentCustodian || input.handler || 'CURRENT_CUSTODY',
      reason: 'COUNT_CONDITION_OR_SCAN_FOLLOWS_CURRENT_CUSTODY',
    }, 'NETWORK_CONTROL', 'OPEN_ESCALATION_READY');
  }

  if (exceptionType === 'MISROUTE' || exceptionType === 'MNR') {
    return withEscalation({
      ownerRole: 'NETWORK_CONTROL',
      ownerParty: 'ORIGIN_HUB',
      reason: 'MISROUTE_OWNED_BY_DISPATCHING_NETWORK',
    }, 'NETWORK_CONTROL', 'ESCALATED_TO_NETWORK');
  }

  if (exceptionType === 'DELAY' || exceptionType === 'DELAY_RISK') {
    return withEscalation({
      ownerRole: 'SLA_CONTROLLER',
      ownerParty: 'LINEHAUL_OWNER',
      reason: 'DELAY_WITHOUT_SIDE_OR_BOOKING_DEFAULTS_TO_MOVEMENT_OWNER',
    });
  }

  if (String(input.operatorType ?? '').toUpperCase().includes('CO_LOADER') || String(input.operatorType ?? '').toUpperCase().includes('COLOADER')) {
    return withEscalation({ ownerRole: 'COLOADER_OPS', ownerParty: 'COLOADER', reason: 'COLOADER_OPERATOR_DEFAULT' });
  }
  return withEscalation({ ownerRole: 'COURIER_OPS', ownerParty: 'COURIER', reason: 'COURIER_OPERATOR_DEFAULT' });
}

export function evaluateHandoverProofGate(input: {
  required: boolean;
  proofPresent: boolean;
  evidenceRef?: string | null;
  kind?: HandoverProofKind | null;
}): { allowed: boolean; blockers: string[] } {
  if (!input.required) return { allowed: true, blockers: [] };
  if (input.proofPresent && input.evidenceRef) return { allowed: true, blockers: [] };
  return { allowed: false, blockers: ['HANDOVER_PROOF_REQUIRED'] };
}

export function buildGstInvoiceReadyOutput(input: {
  tenantId: string;
  invoiceId: string;
  invoiceDate: string;
  supplierLegalName: string;
  supplierGstin?: string | null;
  recipientLegalName: string;
  recipientGstin?: string | null;
  supplierStateCode?: string | null;
  recipientStateCode?: string | null;
  placeOfSupplyStateCode?: string | null;
  lineDescription: string;
  hsnSac?: string | null;
  taxableValue: number;
  taxRatePct: number;
  taxSplit: { cgst: number; sgst: number; igst: number; total_tax: number; total_with_tax: number };
  legalReviewRequired?: boolean;
}): Record<string, unknown> {
  return {
    format: 'GST_INVOICE_READY_V0',
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    invoiceDate: input.invoiceDate,
    supplier: { legalName: input.supplierLegalName, gstin: input.supplierGstin ?? null, stateCode: input.supplierStateCode ?? null },
    recipient: { legalName: input.recipientLegalName, gstin: input.recipientGstin ?? null, stateCode: input.recipientStateCode ?? null },
    placeOfSupplyStateCode: input.placeOfSupplyStateCode ?? input.recipientStateCode ?? input.supplierStateCode ?? null,
    line: {
      description: input.lineDescription,
      hsnSac: input.hsnSac ?? null,
      taxableValue: input.taxableValue,
      taxRatePct: input.taxRatePct,
    },
    tax: input.taxSplit,
    legalReviewRequired: input.legalReviewRequired === true,
    placeOfSupplyRule: 'CONFIGURED_OR_MANUAL_LEGAL_REVIEW_SEAM',
    aiRequired: false,
    externalApiRequired: false,
  };
}

export const TALLY_CONNECTOR_SCHEMA_FIELDS = ['id', 'voucherNumber', 'amount', 'type', 'ledger'] as const;

export function buildTallyCompatibleVouchers(input: {
  tenantId: string;
  invoices: Array<{ invoiceId: string; amount: number; ledger: string; voucherNumber?: string; date?: string; taxAmount?: number }>;
  payables: Array<{ payableId: string; amount: number; ledger: string; voucherNumber?: string; date?: string; taxAmount?: number }>;
}): {
  exportType: 'TALLY';
  format: 'TALLY_CONNECTOR_VOUCHER_ROWS';
  formatAuthority: string;
  tenantId: string;
  vouchers: Array<Record<string, unknown>>;
  sourceIds: string[];
  csv: string;
} {
  const vouchers = [
    ...input.invoices.map((row) => ({
      id: row.invoiceId,
      voucherNumber: row.voucherNumber ?? row.invoiceId,
      amount: row.amount,
      type: 'SALES',
      ledger: row.ledger,
      date: row.date ?? null,
      taxAmount: row.taxAmount ?? null,
      sourceKind: 'CUSTOMER_INVOICE',
      tenantId: input.tenantId,
    })),
    ...input.payables.map((row) => ({
      id: row.payableId,
      voucherNumber: row.voucherNumber ?? row.payableId,
      amount: row.amount,
      type: 'PURCHASE',
      ledger: row.ledger,
      date: row.date ?? null,
      taxAmount: row.taxAmount ?? null,
      sourceKind: 'VENDOR_PAYABLE',
      tenantId: input.tenantId,
    })),
  ];
  const header = [...TALLY_CONNECTOR_SCHEMA_FIELDS, 'date', 'taxAmount', 'sourceKind', 'tenantId'].join(',');
  const csv = [
    header,
    ...vouchers.map((row) =>
      [row.id, row.voucherNumber, row.amount, row.type, row.ledger, row.date ?? '', row.taxAmount ?? '', row.sourceKind, row.tenantId].join(','),
    ),
  ].join('\n');
  return {
    exportType: 'TALLY',
    format: 'TALLY_CONNECTOR_VOUCHER_ROWS',
    formatAuthority: '36_NEXOS_OpenAPI_v1.yaml#InvoiceAction.exportType=TALLY + tally-connector.adapter.ts#getSchema',
    tenantId: input.tenantId,
    vouchers,
    sourceIds: vouchers.map((row) => String(row.id)),
    csv,
  };
}

export const V0_COLOADER_FLOW_STEPS = [
  'BOOKING',
  'COUNTERPARTY_VALIDATION',
  'DOCUMENT_REFERENCE',
  'RESPONSIBILITY_DERIVATION',
  'PICKUP_OR_HANDOVER',
  'BAG_ACCEPTANCE',
  'MANIFEST',
  'MOVEMENT_MASTER',
  'AIRPORT_RESPONSIBILITY',
  'DESTINATION_HANDOVER',
  'BILLING',
  'PAYABLE',
  'CLOSURE',
] as const;

export function productizeCoLoaderFlowPlan(config: CoLoaderConfig): {
  config: CoLoaderConfig;
  steps: typeof V0_COLOADER_FLOW_STEPS;
  responsibility: ReturnType<typeof deriveCoLoaderResponsibility>;
  bagOwnerRule: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED';
} {
  return {
    config,
    steps: V0_COLOADER_FLOW_STEPS,
    responsibility: deriveCoLoaderResponsibility(config),
    bagOwnerRule: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED',
  };
}

export function evaluateAiDisabledCoreGate(input: { aiEnabled?: boolean; operation: string }): {
  allowed: boolean;
  blockers: string[];
  aiRequired: false;
} {
  return {
    allowed: true,
    blockers: input.aiEnabled === true ? [] : [],
    aiRequired: false,
  };
}

export const V1_ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'HALF_DAY',
  'MISSING_PUNCH',
  'SHIFT_MISMATCH',
] as const;
export type V1AttendanceStatus = (typeof V1_ATTENDANCE_STATUSES)[number];

export const V1_CORRECTION_STATES = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type V1CorrectionState = (typeof V1_CORRECTION_STATES)[number];

export const V1_CREDIT_DECISIONS = ['ALLOW', 'WARN', 'BLOCK'] as const;
export type V1CreditDecision = (typeof V1_CREDIT_DECISIONS)[number];

export const V1_MARGIN_LEVELS = ['SHIPMENT', 'BAG', 'MANIFEST', 'CUSTOMER'] as const;
export type V1MarginLevel = (typeof V1_MARGIN_LEVELS)[number];

export const V1_DASHBOARD_KINDS = ['OWNER', 'COURIER', 'CO_LOADER'] as const;
export type V1DashboardKind = (typeof V1_DASHBOARD_KINDS)[number];

export const V1_IMPORT_MASTER_TYPES = [
  'customers',
  'parties',
  'rates',
  'lanes',
  'employees',
  'branches',
  'airports',
  'vendors',
  'co-loaders',
  'opening-balances',
] as const;
export type V1ImportMasterType = (typeof V1_IMPORT_MASTER_TYPES)[number];

export const V1_MIS_SUBJECTS = [
  'shipments',
  'bags',
  'exceptions',
  'attendance',
  'billing',
  'AR',
  'AP',
  'margin',
  'branch',
  'department',
] as const;
export type V1MisSubject = (typeof V1_MIS_SUBJECTS)[number];

export const V1_ALERT_TRIGGERS = [
  'MISSED_SCAN',
  'PENDING_LODGEMENT',
  'PENDING_RETRIEVAL',
  'MISSING_PROOF',
  'OVERDUE_EXCEPTION',
  'ABSENT_EMPLOYEE',
  'CREDIT_BLOCK',
  'BILLING_HOLD',
] as const;
export type V1AlertTrigger = (typeof V1_ALERT_TRIGGERS)[number];

export type V1AttendancePolicy = {
  policyVersion?: string;
  lateGraceMinutes?: number;
  halfDayMaxHours?: number;
};

export type V1AttendanceEvaluationInput = {
  tenantId: string;
  employeeRef: string;
  attendanceDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  isRestDay?: boolean;
  isHoliday?: boolean;
  shiftAssigned?: boolean;
  assignedShiftCode?: string | null;
  actualShiftCode?: string | null;
  policy?: V1AttendancePolicy | null;
  evaluateClose?: boolean;
};

export type V1AttendanceEvaluation = {
  status: V1AttendanceStatus;
  lateByMinutes: number | null;
  hoursWorked: number | null;
  reasonCodes: string[];
  policyVersion: string | null;
};

export type V1GovernedShiftSchedule = {
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  overnight: boolean;
};

export type V1WeeklyOffPatternFact = {
  employeeRef?: string | null;
  shiftCode?: string | null;
  weekdays?: unknown;
  status?: string | null;
};

const UTC_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function attendanceDateKey(value: string): string | null {
  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function padClockPart(value: number): string {
  return String(value).padStart(2, '0');
}

function parseShiftClock(value: string): { h: number; m: number; s: number } | null {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] ?? 0);
  if (h > 23 || m > 59 || s > 59) return null;
  return { h, m, s };
}

function clockInstantOnDate(attendanceDate: string, clock: string): string | null {
  const dateKey = attendanceDateKey(attendanceDate);
  const parsed = parseShiftClock(clock);
  if (!dateKey || !parsed) return null;
  return `${dateKey}T${padClockPart(parsed.h)}:${padClockPart(parsed.m)}:${padClockPart(parsed.s)}.000Z`;
}

function addUtcCalendarDays(attendanceDate: string, days: number): string | null {
  const dateKey = attendanceDateKey(attendanceDate);
  if (!dateKey) return null;
  const instant = new Date(`${dateKey}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

export function utcWeekdayFromAttendanceDate(attendanceDate: string): (typeof UTC_WEEKDAYS)[number] | null {
  const dateKey = attendanceDateKey(attendanceDate);
  if (!dateKey) return null;
  const instant = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) return null;
  return UTC_WEEKDAYS[instant.getUTCDay()];
}

/** Compose ShiftDefinition HH:mm clocks onto the attendance YYYY-MM-DD in the existing punch/evaluator ISO instant space. */
export function composeGovernedShiftSchedule(input: {
  attendanceDate: string;
  startTime?: string | null;
  endTime?: string | null;
}): V1GovernedShiftSchedule {
  const scheduledStartAt = input.startTime ? clockInstantOnDate(input.attendanceDate, input.startTime) : null;
  let scheduledEndAt = input.endTime ? clockInstantOnDate(input.attendanceDate, input.endTime) : null;
  let overnight = false;
  if (scheduledStartAt && scheduledEndAt && Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt)) {
    const nextDate = addUtcCalendarDays(input.attendanceDate, 1);
    scheduledEndAt = nextDate && input.endTime ? clockInstantOnDate(nextDate, input.endTime) : null;
    overnight = true;
  }
  return { scheduledStartAt, scheduledEndAt, overnight };
}

function normalizeShiftCode(value?: string | null): string {
  return value == null ? '' : String(value).trim().toUpperCase();
}

export function isRestDayFromWeeklyOffPatterns(
  patterns: V1WeeklyOffPatternFact[] | null | undefined,
  input: {
    employeeId: string;
    employeeCode?: string | null;
    assignedShiftCode?: string | null;
    attendanceDate: string;
  },
): boolean {
  const weekday = utcWeekdayFromAttendanceDate(input.attendanceDate);
  if (!weekday) return false;
  const assigned = normalizeShiftCode(input.assignedShiftCode);
  const employeeId = String(input.employeeId ?? '').trim();
  const employeeCode = String(input.employeeCode ?? '').trim();
  const active = (patterns ?? []).filter((row) => String(row.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE');
  const coversToday = (row: V1WeeklyOffPatternFact) => {
    const days = Array.isArray(row.weekdays) ? row.weekdays.map((day) => String(day).trim().toUpperCase()) : [];
    return days.includes(weekday);
  };
  const employeeRefMatches = (row: V1WeeklyOffPatternFact) => {
    const ref = String(row.employeeRef ?? '').trim();
    if (!ref) return false;
    return ref === employeeId || (!!employeeCode && ref === employeeCode);
  };
  if (active.some((row) => employeeRefMatches(row) && coversToday(row))) return true;
  if (assigned && active.some((row) => !row.employeeRef && normalizeShiftCode(row.shiftCode) === assigned && coversToday(row))) {
    return true;
  }
  return active.some((row) => !row.employeeRef && !row.shiftCode && coversToday(row));
}

export function evaluateAttendancePolicy(input: V1AttendanceEvaluationInput): V1AttendanceEvaluation {
  const policyVersion = input.policy?.policyVersion ?? null;
  const checkIn = input.checkInAt ? new Date(input.checkInAt) : null;
  const checkOut = input.checkOutAt ? new Date(input.checkOutAt) : null;
  const hoursWorked =
    checkIn && checkOut
      ? Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100
      : null;
  const assignedShiftCode = normalizeShiftCode(input.assignedShiftCode);
  const actualShiftCode = normalizeShiftCode(input.actualShiftCode);
  const shiftAssigned =
    input.assignedShiftCode !== undefined ? assignedShiftCode.length > 0 : input.shiftAssigned !== false;

  if (input.isRestDay === true || input.isHoliday === true) {
    if (checkIn) {
      return {
        status: 'SHIFT_MISMATCH',
        lateByMinutes: null,
        hoursWorked,
        reasonCodes: ['PUNCH_ON_REST_OR_HOLIDAY'],
        policyVersion,
      };
    }
    return {
      status: 'ABSENT',
      lateByMinutes: null,
      hoursWorked,
      reasonCodes: ['REST_OR_HOLIDAY_NO_DUTY'],
      policyVersion,
    };
  }

  if (checkIn && assignedShiftCode && actualShiftCode && assignedShiftCode !== actualShiftCode) {
    return {
      status: 'SHIFT_MISMATCH',
      lateByMinutes: null,
      hoursWorked,
      reasonCodes: ['ASSIGNED_VS_ACTUAL_SHIFT_MISMATCH'],
      policyVersion,
    };
  }

  if (!shiftAssigned && checkIn) {
    return {
      status: 'SHIFT_MISMATCH',
      lateByMinutes: null,
      hoursWorked,
      reasonCodes: ['NO_SHIFT_ASSIGNED'],
      policyVersion,
    };
  }

  if (!checkIn && !checkOut) {
    return {
      status: 'ABSENT',
      lateByMinutes: null,
      hoursWorked: null,
      reasonCodes: ['NO_PUNCH'],
      policyVersion,
    };
  }

  if (checkIn && !checkOut && input.evaluateClose === true) {
    return {
      status: 'MISSING_PUNCH',
      lateByMinutes: null,
      hoursWorked: null,
      reasonCodes: ['CHECK_OUT_MISSING'],
      policyVersion,
    };
  }

  let lateByMinutes: number | null = null;
  const reasonCodes: string[] = [];
  let status: V1AttendanceStatus = 'PRESENT';

  const lateGrace = input.policy?.lateGraceMinutes;
  if (checkIn && input.scheduledStartAt && typeof lateGrace === 'number') {
    const scheduled = new Date(input.scheduledStartAt);
    lateByMinutes = Math.round((checkIn.getTime() - scheduled.getTime()) / 60000);
    if (lateByMinutes > lateGrace) {
      status = 'LATE';
      reasonCodes.push('AFTER_SCHEDULED_START_PLUS_GRACE');
    }
  }

  const halfDayMax = input.policy?.halfDayMaxHours;
  if (hoursWorked != null && typeof halfDayMax === 'number' && hoursWorked < halfDayMax) {
    status = 'HALF_DAY';
    reasonCodes.push('HOURS_BELOW_TENANT_HALF_DAY_MAX');
  }

  if (reasonCodes.length === 0) reasonCodes.push('WITHIN_TENANT_POLICY');
  return { status, lateByMinutes, hoursWorked, reasonCodes, policyVersion };
}

export type V1CorrectionDecisionInput = {
  currentState?: V1CorrectionState | null;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT';
  requesterId: string;
  reviewerId?: string | null;
  reason: string;
  evidenceRef?: string | null;
  decisionReason?: string | null;
  selfApproveAllowed?: boolean;
};

export function evaluateAttendanceCorrection(input: V1CorrectionDecisionInput): {
  allowed: boolean;
  nextState: V1CorrectionState | null;
  blockers: string[];
} {
  if (!String(input.reason ?? '').trim()) {
    return { allowed: false, nextState: null, blockers: ['CORRECTION_REASON_REQUIRED'] };
  }
  if (input.action === 'SUBMIT') {
    return { allowed: true, nextState: 'SUBMITTED', blockers: [] };
  }
  if (input.currentState !== 'SUBMITTED') {
    return { allowed: false, nextState: input.currentState ?? null, blockers: ['CORRECTION_NOT_PENDING'] };
  }
  if (!input.reviewerId) {
    return { allowed: false, nextState: 'SUBMITTED', blockers: ['REVIEWER_REQUIRED'] };
  }
  if (input.selfApproveAllowed !== true && input.reviewerId === input.requesterId) {
    return { allowed: false, nextState: 'SUBMITTED', blockers: ['SELF_APPROVAL_FORBIDDEN'] };
  }
  if (input.action === 'APPROVE' || input.action === 'REJECT') {
    if (!String(input.decisionReason ?? '').trim()) {
      return { allowed: false, nextState: 'SUBMITTED', blockers: ['DECISION_REASON_REQUIRED'] };
    }
    return { allowed: true, nextState: input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED', blockers: [] };
  }
  return { allowed: false, nextState: null, blockers: ['UNKNOWN_CORRECTION_ACTION'] };
}

export type V1AttendanceBucket = {
  department?: string | null;
  branch?: string | null;
  role?: string | null;
  shift?: string | null;
  present: number;
  absent: number;
  late: number;
  missingPunch: number;
  halfDay: number;
  shiftMismatch: number;
};

export function aggregateAttendanceDashboard(
  rows: Array<{
    status: string;
    department?: string | null;
    branch?: string | null;
    role?: string | null;
    shift?: string | null;
  }>,
  groupBy: Array<'department' | 'branch' | 'role' | 'shift'> = [],
): V1AttendanceBucket[] {
  const map = new Map<string, V1AttendanceBucket>();
  for (const row of rows) {
    const key = groupBy.map((g) => String(row[g] ?? '')).join('|') || 'ALL';
    const bucket =
      map.get(key) ??
      {
        department: groupBy.includes('department') ? row.department ?? null : null,
        branch: groupBy.includes('branch') ? row.branch ?? null : null,
        role: groupBy.includes('role') ? row.role ?? null : null,
        shift: groupBy.includes('shift') ? row.shift ?? null : null,
        present: 0,
        absent: 0,
        late: 0,
        missingPunch: 0,
        halfDay: 0,
        shiftMismatch: 0,
      };
    const status = String(row.status ?? '').toUpperCase();
    if (status === 'PRESENT') bucket.present += 1;
    else if (status === 'ABSENT') bucket.absent += 1;
    else if (status === 'LATE') bucket.late += 1;
    else if (status === 'MISSING_PUNCH') bucket.missingPunch += 1;
    else if (status === 'HALF_DAY') bucket.halfDay += 1;
    else if (status === 'SHIFT_MISMATCH') bucket.shiftMismatch += 1;
    map.set(key, bucket);
  }
  return [...map.values()];
}

export type V1MarginLine = {
  level: V1MarginLevel;
  entityId: string;
  revenue: number;
  cost: number;
  grossMargin: number;
  marginPct: number | null;
  exceptionState: string | null;
};

export function composeMarginLine(input: {
  level: V1MarginLevel;
  entityId: string;
  revenue: number;
  cost: number;
  exceptionState?: string | null;
}): V1MarginLine {
  const revenue = Number(input.revenue) || 0;
  const cost = Number(input.cost) || 0;
  const grossMargin = Math.round((revenue - cost) * 100) / 100;
  const marginPct = revenue > 0 ? Math.round((grossMargin / revenue) * 10000) / 100 : null;
  return {
    level: input.level,
    entityId: input.entityId,
    revenue,
    cost,
    grossMargin,
    marginPct,
    exceptionState: input.exceptionState ?? null,
  };
}

export function evaluateCreditAdmission(input: {
  action?: 'NEW_BOOKING' | 'IN_NETWORK_CLOSURE';
  creditOnHold?: boolean;
  creditLimit?: number | null;
  currentExposure?: number | null;
  prospectiveBookingExposure?: number | null;
  warningThresholdPct?: number | null;
  blockThresholdPct?: number | null;
  shipmentAlreadyInNetwork?: boolean;
}): {
  decision: V1CreditDecision;
  resultingExposure: number;
  utilizationPct: number | null;
  reason: string;
} {
  const current = Number(input.currentExposure ?? 0);
  const prospective = Number(input.prospectiveBookingExposure ?? 0);
  const resultingExposure = current + prospective;
  const limit = input.creditLimit == null ? null : Number(input.creditLimit);
  const utilizationPct = limit && limit > 0 ? Math.round((resultingExposure / limit) * 10000) / 100 : null;

  if (input.action === 'IN_NETWORK_CLOSURE' || input.shipmentAlreadyInNetwork === true) {
    return { decision: 'ALLOW', resultingExposure, utilizationPct, reason: 'IN_NETWORK_CLOSURE_ALLOWED' };
  }
  if (input.creditOnHold === true) {
    return { decision: 'BLOCK', resultingExposure, utilizationPct, reason: 'CREDIT_HOLD_BLOCKS_NEW_BOOKING' };
  }
  if (limit == null) {
    return { decision: 'ALLOW', resultingExposure, utilizationPct, reason: 'NO_CREDIT_LIMIT_CONFIGURED' };
  }
  const blockAt = typeof input.blockThresholdPct === 'number' ? input.blockThresholdPct : null;
  const warnAt = typeof input.warningThresholdPct === 'number' ? input.warningThresholdPct : null;
  if (blockAt != null && utilizationPct != null && utilizationPct >= blockAt) {
    return { decision: 'BLOCK', resultingExposure, utilizationPct, reason: 'UTILIZATION_AT_OR_ABOVE_BLOCK_THRESHOLD' };
  }
  if (warnAt != null && utilizationPct != null && utilizationPct >= warnAt) {
    return { decision: 'WARN', resultingExposure, utilizationPct, reason: 'UTILIZATION_AT_OR_ABOVE_WARNING_THRESHOLD' };
  }
  return { decision: 'ALLOW', resultingExposure, utilizationPct, reason: 'WITHIN_CREDIT_POLICY' };
}

export function resolveChargeableWeight(input: {
  actualWeightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  volumetricDivisor?: number | null;
}): { chargeableWeightKg: number; volumetricWeightKg: number | null; source: 'ACTUAL' | 'VOLUMETRIC' } {
  const actual = Number(input.actualWeightKg) || 0;
  const divisor = input.volumetricDivisor;
  const l = input.lengthCm;
  const w = input.widthCm;
  const h = input.heightCm;
  if (typeof divisor !== 'number' || divisor <= 0 || l == null || w == null || h == null) {
    return { chargeableWeightKg: actual, volumetricWeightKg: null, source: 'ACTUAL' };
  }
  const volumetricWeightKg = Math.round(((Number(l) * Number(w) * Number(h)) / divisor) * 1000) / 1000;
  const chargeableWeightKg = Math.max(actual, volumetricWeightKg);
  return {
    chargeableWeightKg,
    volumetricWeightKg,
    source: chargeableWeightKg === volumetricWeightKg && volumetricWeightKg > actual ? 'VOLUMETRIC' : 'ACTUAL',
  };
}

export function applyDomesticRateCompleteness(input: {
  baseAmount: number;
  minimumCharge?: number | null;
  surchargeAmount?: number | null;
  payableCost?: number | null;
}): { customerCharge: number; payableCost: number; margin: number } {
  const base = Number(input.baseAmount) || 0;
  const minimum = typeof input.minimumCharge === 'number' ? input.minimumCharge : 0;
  const surcharge = Number(input.surchargeAmount ?? 0);
  const customerCharge = Math.max(base, minimum) + surcharge;
  const payableCost = Number(input.payableCost ?? 0);
  return {
    customerCharge: Math.round(customerCharge * 100) / 100,
    payableCost: Math.round(payableCost * 100) / 100,
    margin: Math.round((customerCharge - payableCost) * 100) / 100,
  };
}

export type V1ImportRow = {
  rowIdentity: string;
  values: Record<string, unknown>;
  errors: string[];
};

export function evaluateMasterImportBatch(rows: V1ImportRow[]): {
  allOrNothingAccepted: boolean;
  acceptedCount: number;
  rejectedCount: number;
  persistMasters: boolean;
  rowErrors: Array<{ rowIdentity: string; message: string }>;
} {
  const rowErrors = rows.flatMap((row) =>
    row.errors.map((message) => ({ rowIdentity: row.rowIdentity, message })),
  );
  const rejectedCount = rows.filter((row) => row.errors.length > 0).length;
  const acceptedCount = rows.length - rejectedCount;
  const persistMasters = rejectedCount === 0 && rows.length > 0;
  return {
    allOrNothingAccepted: persistMasters,
    acceptedCount: persistMasters ? acceptedCount : 0,
    rejectedCount,
    persistMasters,
    rowErrors,
  };
}

export function buildImportCorrectionCsv(errors: Array<{ rowIdentity: string; message: string }>): string {
  const header = 'rowIdentity,message';
  const lines = errors.map((e) => `${v1CsvCell(e.rowIdentity)},${v1CsvCell(e.message)}`);
  return [header, ...lines].join('\n');
}

function v1CsvCell(value: string): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export type V1AlertEvaluationInput = {
  trigger: V1AlertTrigger;
  conditionMet: boolean;
  nowIso: string;
  lastTriggeredAt?: string | null;
  triggerCountInWindow?: number;
  cooldownMinutes?: number | null;
  frequencyCap?: number | null;
  dedupKey?: string | null;
  lastDedupKey?: string | null;
};

export function evaluateOperationalAlert(input: V1AlertEvaluationInput): {
  shouldTrigger: boolean;
  reason: string;
  nextEligibleAt: string | null;
} {
  if (!input.conditionMet) {
    return { shouldTrigger: false, reason: 'CONDITION_NOT_MET', nextEligibleAt: null };
  }
  if (input.dedupKey && input.lastDedupKey && input.dedupKey === input.lastDedupKey) {
    return { shouldTrigger: false, reason: 'DEDUP_KEY_MATCH', nextEligibleAt: null };
  }
  const now = new Date(input.nowIso);
  if (typeof input.cooldownMinutes === 'number' && input.lastTriggeredAt) {
    const next = new Date(new Date(input.lastTriggeredAt).getTime() + input.cooldownMinutes * 60000);
    if (now < next) {
      return { shouldTrigger: false, reason: 'COOLDOWN_ACTIVE', nextEligibleAt: next.toISOString() };
    }
  }
  if (typeof input.frequencyCap === 'number' && (input.triggerCountInWindow ?? 0) >= input.frequencyCap) {
    return { shouldTrigger: false, reason: 'FREQUENCY_CAP_REACHED', nextEligibleAt: null };
  }
  return { shouldTrigger: true, reason: 'TRIGGER', nextEligibleAt: null };
}

export const V1_DASHBOARD_OWNER_METRICS = [
  'shipments',
  'bags',
  'manifests',
  'exceptions',
  'attendance',
  'billing',
  'AR',
  'AP',
  'margin',
] as const;

export const V1_DASHBOARD_COURIER_METRICS = [
  'pickup',
  'scan',
  'bagging',
  'dispatch',
  'deliveryEpod',
  'ndr',
  'cod',
  'billing',
  'branch',
] as const;

export const V1_DASHBOARD_COLOADER_METRICS = [
  'bookingMix',
  'pendingLodgement',
  'pendingRetrieval',
  'proofPending',
  'exceptions',
  'payables',
  'margin',
] as const;

export const V1_AI_DISABLED_SURFACES = [
  'ATTENDANCE_POLICY',
  'ATTENDANCE_CORRECTION',
  'ATTENDANCE_DASHBOARD',
  'MARGIN',
  'CREDIT_ADMISSION',
  'OWNER_DASHBOARD',
  'COURIER_DASHBOARD',
  'COLOADER_DASHBOARD',
  'MASTER_IMPORT',
  'ADVANCED_RATES',
  'MIS',
  'ALERTS',
] as const;

export const V2_CAPABILITY_CODE = 'INTERNATIONAL_AIR' as const;
export const V2_SHIPMENT_CATEGORY = 'INTERNATIONAL_AIR' as const;
export const V2_BLOCKED_SEA_CATEGORIES = [
  'INTERNATIONAL_SEA',
  'SEA_FREIGHT',
  'OCEAN_FREIGHT',
  'FCL',
  'LCL',
] as const;
export const V2_CORE_DOCUMENT_TYPES = [
  'INVOICE',
  'PACKING_LIST',
  'KYC',
  'SECURITY_DECLARATION',
] as const;
export const V2_CUSTOMS_SAFE_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REFERENCE'] as const;
export const V2_LIFECYCLE_STATES = ['PENDING', 'PROOF_CAPTURED', 'COMPLETED', 'EXCEPTION'] as const;
export const V2_AI_DISABLED_SURFACES = [
  'IA_ADMISSION',
  'IA_REFERENCES',
  'IA_DOCUMENTS',
  'IA_CUSTOMS_CAPTURE',
  'IA_COMMERCIAL',
  'IA_EXPORT_PROOF',
  'IA_IMPORT_PROOF',
  'IA_RESPONSIBILITY',
] as const;

export function isSeaScopeRequested(value: unknown): boolean {
  return typeof value === 'string' && (V2_BLOCKED_SEA_CATEGORIES as readonly string[]).includes(value);
}

export function evaluateInternationalAirAdmission(input: {
  tenantId: string;
  shipmentCategory: unknown;
  capabilityEnabled: boolean;
}): { allowed: boolean; reason: string; category: string | null } {
  if (!input.tenantId) {
    return { allowed: false, reason: 'TENANT_CONTEXT_MISSING', category: null };
  }
  if (isSeaScopeRequested(input.shipmentCategory)) {
    return { allowed: false, reason: 'SEA_SCOPE_UNAVAILABLE', category: null };
  }
  if (input.shipmentCategory !== V2_SHIPMENT_CATEGORY) {
    return { allowed: true, reason: 'NOT_INTERNATIONAL_AIR', category: typeof input.shipmentCategory === 'string' ? input.shipmentCategory : null };
  }
  if (input.capabilityEnabled !== true) {
    return { allowed: false, reason: 'INTERNATIONAL_AIR_CAPABILITY_DISABLED', category: V2_SHIPMENT_CATEGORY };
  }
  return { allowed: true, reason: 'INTERNATIONAL_AIR_ADMITTED', category: V2_SHIPMENT_CATEGORY };
}

export function validateInternationalAirReferences(input: {
  mawbReference?: string | null;
  hawbReference?: string | null;
  airlineCode?: string | null;
  airlineName?: string | null;
  flightNumber?: string | null;
  originAirport?: string | null;
  destinationAirport?: string | null;
  handoverReferences?: string[] | null;
}): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const required = [
    'mawbReference',
    'hawbReference',
    'airlineCode',
    'flightNumber',
    'originAirport',
    'destinationAirport',
  ] as const;
  for (const key of required) {
    if (!String(input[key] ?? '').trim()) missing.push(key);
  }
  if (
    String(input.originAirport ?? '').trim() &&
    String(input.destinationAirport ?? '').trim() &&
    String(input.originAirport).trim() === String(input.destinationAirport).trim()
  ) {
    missing.push('originDestinationDistinct');
  }
  return { valid: missing.length === 0, missing };
}

export function evaluateInternationalAirDocumentChecklist(input: {
  items: Array<{ documentType: string; required: boolean; present: boolean; evidenceRef?: string | null }>;
}): { complete: boolean; missingRequired: string[]; presentCount: number } {
  const missingRequired = input.items
    .filter((item) => item.required && (!item.present || !String(item.evidenceRef ?? '').trim()))
    .map((item) => item.documentType);
  return {
    complete: missingRequired.length === 0,
    missingRequired,
    presentCount: input.items.filter((item) => item.present && String(item.evidenceRef ?? '').trim()).length,
  };
}

export function validateInternationalAirCustomsCapture(input: {
  definitions: Array<{ fieldKey: string; dataType: string; required: boolean }>;
  values: Record<string, unknown>;
}): { valid: boolean; missing: string[]; typeErrors: string[]; filingInvoked: false } {
  const missing: string[] = [];
  const typeErrors: string[] = [];
  for (const def of input.definitions) {
    if (!(V2_CUSTOMS_SAFE_TYPES as readonly string[]).includes(def.dataType)) {
      typeErrors.push(def.fieldKey);
      continue;
    }
    const raw = input.values[def.fieldKey];
    if (def.required && (raw === undefined || raw === null || String(raw).trim() === '')) {
      missing.push(def.fieldKey);
      continue;
    }
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    if (def.dataType === 'NUMBER' && Number.isNaN(Number(raw))) typeErrors.push(def.fieldKey);
    if (def.dataType === 'BOOLEAN' && typeof raw !== 'boolean' && raw !== 'true' && raw !== 'false') {
      typeErrors.push(def.fieldKey);
    }
  }
  return { valid: missing.length === 0 && typeErrors.length === 0, missing, typeErrors, filingInvoked: false };
}

export function evaluateInternationalAirCommercial(input: {
  customerCharge: number;
  vendorCost?: number | null;
  agentCost?: number | null;
  coloaderPayable?: number | null;
  customerCurrency: string;
  costCurrency: string;
  configuredRate?: number | null;
}): {
  calculable: boolean;
  reason: string;
  customerCharge: number;
  payableCost: number;
  margin: number | null;
  currency: string | null;
  components: { vendorCost: number; agentCost: number; coloaderPayable: number };
} {
  const customerCharge = Math.round((Number(input.customerCharge) || 0) * 100) / 100;
  const vendorCost = Math.round((Number(input.vendorCost) || 0) * 100) / 100;
  const agentCost = Math.round((Number(input.agentCost) || 0) * 100) / 100;
  const coloaderPayable = Math.round((Number(input.coloaderPayable) || 0) * 100) / 100;
  const components = { vendorCost, agentCost, coloaderPayable };
  const customerCurrency = String(input.customerCurrency || '').trim().toUpperCase();
  const costCurrency = String(input.costCurrency || '').trim().toUpperCase();
  if (!customerCurrency || !costCurrency) {
    return { calculable: false, reason: 'CURRENCY_REQUIRED', customerCharge, payableCost: 0, margin: null, currency: null, components };
  }
  let payableCost = vendorCost + agentCost + coloaderPayable;
  if (customerCurrency !== costCurrency) {
    if (typeof input.configuredRate !== 'number' || input.configuredRate <= 0) {
      return {
        calculable: false,
        reason: 'CURRENCY_MISMATCH_NO_AUTHORITATIVE_RATE',
        customerCharge,
        payableCost: Math.round(payableCost * 100) / 100,
        margin: null,
        currency: null,
        components,
      };
    }
    payableCost = Math.round(payableCost * input.configuredRate * 100) / 100;
  }
  payableCost = Math.round(payableCost * 100) / 100;
  return {
    calculable: true,
    reason: customerCurrency === costCurrency ? 'SAME_CURRENCY' : 'CONFIGURED_DETERMINISTIC_RATE',
    customerCharge,
    payableCost,
    margin: Math.round((customerCharge - payableCost) * 100) / 100,
    currency: customerCurrency,
    components,
  };
}

export function evaluateInternationalAirLifecycleTransition(input: {
  current: (typeof V2_LIFECYCLE_STATES)[number];
  action: 'CAPTURE_PROOF' | 'COMPLETE' | 'EXCEPTION';
  proofPresent?: boolean;
}): { allowed: boolean; next: (typeof V2_LIFECYCLE_STATES)[number]; reason: string } {
  if (input.action === 'EXCEPTION') {
    return { allowed: true, next: 'EXCEPTION', reason: 'EXCEPTION_RECORDED' };
  }
  if (input.action === 'CAPTURE_PROOF') {
    if (input.proofPresent !== true) {
      return { allowed: false, next: input.current, reason: 'PROOF_REQUIRED' };
    }
    return { allowed: true, next: 'PROOF_CAPTURED', reason: 'PROOF_CAPTURED' };
  }
  if (input.action === 'COMPLETE') {
    if (input.current !== 'PROOF_CAPTURED' && input.proofPresent !== true) {
      return { allowed: false, next: input.current, reason: 'PROOF_REQUIRED_BEFORE_COMPLETE' };
    }
    return { allowed: true, next: 'COMPLETED', reason: 'COMPLETED' };
  }
  return { allowed: false, next: input.current, reason: 'INVALID_TRANSITION' };
}

export function deriveInternationalAirResponsibility(input: {
  config: 'PARTY_TO_PARTY' | 'PARTY_TO_COLOADER' | 'COLOADER_TO_COLOADER' | 'COLOADER_TO_PARTY';
  originAirport: string;
  destinationAirport: string;
}): {
  airportLodgementResponsibleParty: 'COURIER_PARTY_SIDE' | 'COLOADER';
  destinationAirportRetrievalResponsibleParty: 'COURIER_PARTY_SIDE' | 'COLOADER';
  originAirport: string;
  destinationAirport: string;
  bagOwnership: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED';
} {
  const derived = deriveCoLoaderResponsibility(input.config);
  return {
    ...derived,
    originAirport: String(input.originAirport || '').trim(),
    destinationAirport: String(input.destinationAirport || '').trim(),
    bagOwnership: 'COURIER_CREATED_BAGS_REMAIN_COURIER_OWNED',
  };
}

export function evaluateInternationalAirResponsibilityOverride(input: {
  reason?: string | null;
  actorId?: string | null;
  at?: string | null;
}): { allowed: boolean; reason: string } {
  if (!String(input.reason ?? '').trim()) {
    return { allowed: false, reason: 'OVERRIDE_REASON_REQUIRED' };
  }
  if (!String(input.actorId ?? '').trim()) {
    return { allowed: false, reason: 'OVERRIDE_ACTOR_REQUIRED' };
  }
  if (!String(input.at ?? '').trim()) {
    return { allowed: false, reason: 'OVERRIDE_TIMESTAMP_REQUIRED' };
  }
  return { allowed: true, reason: 'OVERRIDE_AUDITED' };
}
