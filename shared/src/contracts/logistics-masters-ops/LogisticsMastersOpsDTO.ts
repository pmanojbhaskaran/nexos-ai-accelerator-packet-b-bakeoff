/**
 * LogisticsMastersOpsDTO.ts
 * Cluster 12: Logistics Masters + Ops shared contracts
 * Canon: DOC-000008, DOC-000045 S3-5, DOC-000044 P6, DOC-000060 S5.1
 */

// ==========================================
// 26. Commodity Master (enhance)
// ==========================================
export interface CommodityMasterDTO {
  id: string;
  tenantId: string;
  commodityCode: string;
  commodityName: string;
  handlingFactor: number;
  insuranceFactor: number;
  specialHandling: boolean;
  temperatureControlled: boolean;
  dgCode: string | null;
  unCode: string | null;
  pharmaTemperatureBand: string | null;
  gdpCompliance: boolean;
  packagingProfileRef: string | null;
  hazardClass: string | null;
  commodityCategory: string;
  weightRangeMinKg: number | null;
  weightRangeMaxKg: number | null;
  volumeCategory: string | null;
  status: string;
}

export interface UpsertCommodityMasterPayload {
  commodityCode: string;
  commodityName: string;
  handlingFactor?: number;
  insuranceFactor?: number;
  specialHandling?: boolean;
  temperatureControlled?: boolean;
  dgCode?: string | null;
  unCode?: string | null;
  pharmaTemperatureBand?: string | null;
  gdpCompliance?: boolean;
  packagingProfileRef?: string | null;
  hazardClass?: string | null;
  commodityCategory?: string;
  weightRangeMinKg?: number | null;
  weightRangeMaxKg?: number | null;
  volumeCategory?: string | null;
  status?: string;
}

// ==========================================
// 27. Customer Master (enhance)
// ==========================================
export interface CustomerMasterDTO {
  id: string;
  tenantId: string;
  accountCode: string;
  accountName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  billingMode: string;
  contractType: string;
  qualificationStatus: string;
  serviceClassSet: unknown | null;
  restrictedShipmentClasses: unknown | null;
  defaultPricingFloorRef: string | null;
  customerSegment: string;
  creditTermDays: number;
  gstNumber: string | null;
  panNumber: string | null;
  status: string;
}

export interface UpdateCustomerMasterPayload {
  accountName?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  billingMode?: string;
  contractType?: string;
  qualificationStatus?: string;
  serviceClassSet?: unknown | null;
  restrictedShipmentClasses?: unknown | null;
  defaultPricingFloorRef?: string | null;
  customerSegment?: string;
  creditTermDays?: number;
  gstNumber?: string | null;
  panNumber?: string | null;
  status?: string;
}

// ==========================================
// 28. Lane Master (enhance)
// ==========================================
export interface LaneMasterEnhancedDTO {
  id: string;
  tenant_id: string;
  from_facility_code: string;
  to_facility_code: string;
  mode: string;
  lane_class: string;
  priority: number;
  tat_minutes: number | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  compliance_constraint_set: unknown | null;
  transit_time_profile_ref: string | null;
  capacity_class: string | null;
  distance_km: number | null;
  cost_per_km: number | null;
  service_frequency: string | null;
}

export interface UpdateLaneMasterPayload {
  compliance_constraint_set?: unknown | null;
  transit_time_profile_ref?: string | null;
  capacity_class?: string | null;
  distance_km?: number | null;
  cost_per_km?: number | null;
  service_frequency?: string | null;
  priority?: number;
  tat_minutes?: number | null;
}

// ==========================================
// 29. Rate Card Management (enhance)
// ==========================================
export interface RateCardEnhancedDTO {
  id: string;
  tenantId: string;
  rateCardCode: string;
  customerAccountId: string;
  contractId: string | null;
  mode: string;
  serviceClass: string;
  currency: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  versionNumber: number;
  parentRateCardId: string | null;
  surchargeRulesJson: unknown | null;
  floorPriceRef: string | null;
  lineItemCount: number;
}

export interface ApproveRateCardPayload {
  rateCardId: string;
  approvedBy: string;
}

export interface CreateRateCardVersionPayload {
  parentRateCardId: string;
  effectiveFrom: string;
  effectiveTo: string;
}

// ==========================================
// 30. Vendor Master (enhance)
// ==========================================
export interface VendorMasterEnhancedDTO {
  id: string;
  tenantId: string;
  vendorCode: string;
  vendorName: string;
  vendorType: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  qualificationStatus: string;
  performanceScore: number | null;
  serviceScope: unknown | null;
  laneCoverageJson: unknown | null;
  capabilitySet: unknown | null;
  requalificationDate: string | null;
  restrictionSet: unknown | null;
  complianceCertifications: unknown | null;
  status: string;
}

export interface UpdateVendorMasterPayload {
  vendorName?: string;
  vendorType?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  qualificationStatus?: string;
  serviceScope?: unknown | null;
  laneCoverageJson?: unknown | null;
  capabilitySet?: unknown | null;
  requalificationDate?: string | null;
  restrictionSet?: unknown | null;
  complianceCertifications?: unknown | null;
  status?: string;
}

// ==========================================
// 31. Hub Operations (DOC-000045 S3-4)
// ==========================================
export interface HubInboundScanDTO {
  id: string;
  tenantId: string;
  hubId: string;
  manifestRef: string | null;
  shipmentRef: string;
  scanType: string;
  scannedBy: string;
  scannedAt: string;
  barcodeValue: string;
  weightKg: number | null;
  dimensionJson: unknown | null;
  conditionStatus: string;
  discrepancyNote: string | null;
  photoRef: string | null;
}

export interface CreateHubInboundScanPayload {
  hubId: string;
  manifestRef?: string | null;
  shipmentRef: string;
  scanType: string;
  barcodeValue: string;
  weightKg?: number | null;
  dimensionJson?: unknown | null;
  conditionStatus?: string;
  discrepancyNote?: string | null;
  photoRef?: string | null;
}

export interface HubSortRecordDTO {
  id: string;
  tenantId: string;
  hubId: string;
  shipmentRef: string;
  sortedBy: string;
  sortedAt: string;
  laneBin: string;
  serviceTier: string;
  commodityCode: string | null;
  sortStatus: string;
}

export interface CreateHubSortPayload {
  hubId: string;
  shipmentRef: string;
  laneBin: string;
  serviceTier: string;
  commodityCode?: string | null;
}

export interface HubBagRecordDTO {
  id: string;
  tenantId: string;
  hubId: string;
  bagCode: string;
  sealNumber: string;
  destinationHub: string;
  shipmentCount: number;
  shipmentRefsJson: unknown;
  totalWeightKg: number | null;
  baggedBy: string;
  baggedAt: string;
  sealVerified: boolean;
  stagedForLinehaul: boolean;
  stagedAt: string | null;
  linehaulRef: string | null;
  status: string;
}

export interface CreateHubBagPayload {
  hubId: string;
  bagCode: string;
  sealNumber: string;
  destinationHub: string;
  shipmentRefsJson: unknown;
}

export interface StageBagForLinehaulPayload {
  bagId: string;
  linehaulRef: string;
}

// ==========================================
// 32. Linehaul Operations (DOC-000045 S5)
// ==========================================
export interface LinehaulTripDTO {
  id: string;
  tenantId: string;
  tripCode: string;
  originHubRef: string;
  destinationHubRef: string;
  mode: string;
  carrierRef: string | null;
  vehicleRef: string | null;
  driverRef: string | null;
  flightNumber: string | null;
  bagCount: number;
  bagRefsJson: unknown;
  shipmentCount: number;
  totalWeightKg: number | null;
  scheduledDepartAt: string;
  actualDepartAt: string | null;
  scheduledArriveAt: string;
  actualArriveAt: string | null;
  dispatchedBy: string | null;
  receivedBy: string | null;
  sealIntact: boolean | null;
  shortCount: number;
  excessCount: number;
  damageCount: number;
  status: string;
}

export interface CreateLinehaulTripPayload {
  tripCode: string;
  originHubRef: string;
  destinationHubRef: string;
  mode: string;
  carrierRef?: string | null;
  vehicleRef?: string | null;
  driverRef?: string | null;
  flightNumber?: string | null;
  bagRefsJson: unknown;
  scheduledDepartAt: string;
  scheduledArriveAt: string;
}

export interface DispatchLinehaulPayload {
  tripId: string;
  dispatchedBy: string;
}

export interface ReceiveLinehaulPayload {
  tripId: string;
  receivedBy: string;
  sealIntact: boolean;
  shortCount?: number;
  excessCount?: number;
  damageCount?: number;
}

// ==========================================
// 33. Transhipment Control (DOC-000044 P6)
// ==========================================
export interface TranshipmentRecordDTO {
  id: string;
  tenantId: string;
  shipmentRef: string;
  currentHubRef: string;
  nextHubRef: string;
  inboundTripRef: string | null;
  outboundTripRef: string | null;
  arrivalScanRef: string | null;
  departureScanRef: string | null;
  conditionOnArrival: string;
  routeEvaluation: string;
  nextLegMode: string | null;
  decidedBy: string;
  decidedAt: string;
  status: string;
  exceptionNote: string | null;
}

export interface CreateTranshipmentPayload {
  shipmentRef: string;
  currentHubRef: string;
  nextHubRef: string;
  inboundTripRef?: string | null;
  routeEvaluation: string;
  nextLegMode?: string | null;
  conditionOnArrival?: string;
}

export interface AssignOutboundTripPayload {
  transhipmentId: string;
  outboundTripRef: string;
  departureScanRef?: string | null;
}

// ==========================================
// 34. Pre-Pickup Checklist (DOC-000060 S5.1)
// ==========================================
export interface PrePickupChecklistDTO {
  id: string;
  tenantId: string;
  shipmentRef: string;
  pickupTaskRef: string;
  executiveUserId: string;
  expectedPackageCount: number;
  actualPackageCount: number | null;
  packagingProfileRef: string | null;
  labelAvailability: boolean;
  sealRequired: boolean;
  sealVerified: boolean;
  chainOfCustodyRequired: boolean;
  documentRequired: boolean;
  documentVerified: boolean;
  commodityHandlingNote: string | null;
  temperatureCheckRequired: boolean;
  temperatureReading: number | null;
  overallStatus: string;
  completedAt: string | null;
  discrepancyCount: number;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  deviceId: string | null;
  offlineCaptured: boolean;
  syncedAt: string | null;
  items: PrePickupChecklistItemDTO[];
}

export interface PrePickupChecklistItemDTO {
  id: string;
  itemCode: string;
  itemLabel: string;
  category: string;
  required: boolean;
  passed: boolean;
  evidenceRef: string | null;
  failureReason: string | null;
  checkedBy: string;
  checkedAt: string | null;
  notes: string | null;
}

export interface CreatePrePickupChecklistPayload {
  shipmentRef: string;
  pickupTaskRef: string;
  expectedPackageCount: number;
  packagingProfileRef?: string | null;
  sealRequired?: boolean;
  chainOfCustodyRequired?: boolean;
  documentRequired?: boolean;
  temperatureCheckRequired?: boolean;
  commodityHandlingNote?: string | null;
  items: CreateChecklistItemPayload[];
}

export interface CreateChecklistItemPayload {
  itemCode: string;
  itemLabel: string;
  category: string;
  required?: boolean;
}

export interface CompleteChecklistPayload {
  checklistId: string;
  actualPackageCount: number;
  labelAvailability: boolean;
  sealVerified?: boolean;
  documentVerified?: boolean;
  temperatureReading?: number | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  deviceId?: string | null;
  offlineCaptured?: boolean;
  items: CompleteChecklistItemPayload[];
}

export interface CompleteChecklistItemPayload {
  itemCode: string;
  passed: boolean;
  evidenceRef?: string | null;
  failureReason?: string | null;
  notes?: string | null;
}

// ==========================================
// Summary response for list endpoints
// ==========================================
export interface LogisticsMastersListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
