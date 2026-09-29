/**
 * Pure mobile field-operation gates ΓÇö no Shared imports.
 * Deterministic helpers for delivered-closure COD checks and offline idempotency keys.
 */

export function evaluateCodRequiredForDeliveredClosure(input: {
  deliveryStatus?: string | null;
  codRequired?: boolean;
  codCollected?: boolean;
}): { allowed: boolean; blockers: string[] } {
  const status = String(input.deliveryStatus ?? '').trim().toUpperCase();
  if (
    (status === 'DELIVERED' || status === 'DELIVERY_CLOSED') &&
    input.codRequired === true &&
    input.codCollected !== true
  ) {
    return { allowed: false, blockers: ['COD_COLLECTION_REQUIRED_FOR_DELIVERED_CLOSURE'] };
  }
  return { allowed: true, blockers: [] };
}

export function evaluateOfflineIdempotentKey(input: {
  shipmentId?: string | null;
  action?: string | null;
  evidenceHash?: string | null;
}): { key: string } {
  const shipmentId = String(input.shipmentId ?? '').trim();
  const action = String(input.action ?? '').trim().toUpperCase();
  const evidenceHash = String(input.evidenceHash ?? '').trim().toLowerCase();
  return { key: `mobile-offline:${shipmentId}:${action}:${evidenceHash}` };
}

/** Prevent duplicate offline sync of the same evidence event. */
export function evaluateDuplicateOfflineEvent(input: {
  queuedKeys: readonly string[];
  candidateKey: string;
}): { duplicate: boolean; blockers: string[] } {
  const key = String(input.candidateKey ?? '').trim();
  if (!key) {
    return { duplicate: false, blockers: ['OFFLINE_IDEMPOTENCY_KEY_REQUIRED'] };
  }
  if (input.queuedKeys.includes(key)) {
    return { duplicate: true, blockers: ['DUPLICATE_OFFLINE_EVENT'] };
  }
  return { duplicate: false, blockers: [] };
}

/**
 * Field gate: ops proof surfaces require setup projection flags when present.
 * Missing projection is treated as not-configured (block for go-live proofs only).
 */
export function evaluateOpsSetupProjectionGate(input: {
  requirePodMandatory?: boolean;
  podMandatoryForDeliveredClosure?: boolean | null;
  requireNdrEnabled?: boolean;
  ndrEnabled?: boolean | null;
  requireRtoEnabled?: boolean;
  rtoEnabled?: boolean | null;
}): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (input.requirePodMandatory && input.podMandatoryForDeliveredClosure !== true) {
    blockers.push('POD_MANDATORY_RULE_NOT_PROJECTED');
  }
  if (input.requireNdrEnabled && input.ndrEnabled !== true) {
    blockers.push('NDR_RULE_NOT_PROJECTED');
  }
  if (input.requireRtoEnabled && input.rtoEnabled !== true) {
    blockers.push('RTO_RULE_NOT_PROJECTED');
  }
  return { allowed: blockers.length === 0, blockers };
}

/** Co-loader field acceptance gate ΓÇö courier-created bags must not flip owner. */
export function evaluateCoLoaderBagOwnershipGate(input: {
  bagCreatedByCourier?: boolean;
  actorIsCoLoader?: boolean;
  attemptingCreateBag?: boolean;
}): { allowed: boolean; blockers: string[] } {
  if (
    input.bagCreatedByCourier === true &&
    input.actorIsCoLoader === true &&
    input.attemptingCreateBag === true
  ) {
    return { allowed: false, blockers: ['COLOADER_MUST_NOT_CREATE_COURIER_BAGS'] };
  }
  return { allowed: true, blockers: [] };
}

/**
 * Field readiness for Road/Rail/Air master mapping ΓÇö requires evidence ref (not free boolean).
 * Evidence may be setup-projected CAP-013 mapping or POST /movement-master/links.
 */
export function evaluateRoadRailMasterMappingGate(input: {
  roadRailMasterMapped?: boolean;
  roadRailMasterMappingEvidenceRef?: string | null;
  mode?: string | null;
  masterReference?: string | null;
  airMawbReference?: string | null;
  attemptedStockGenerateMawb?: boolean;
}): { allowed: boolean; blockers: string[] } {
  const mode = String(input.mode ?? '')
    .trim()
    .toUpperCase();
  if (mode === 'AIR' || mode === 'ROAD' || mode === 'RAIL') {
    const blockers: string[] = [];
    if (input.roadRailMasterMapped !== true) blockers.push('MOVEMENT_MASTER_MAPPING_REQUIRED');
    if (!String(input.masterReference ?? input.roadRailMasterMappingEvidenceRef ?? '').trim()) {
      blockers.push('MOVEMENT_MASTER_REFERENCE_REQUIRED');
    }
    if (!String(input.roadRailMasterMappingEvidenceRef ?? '').trim()) {
      blockers.push('MOVEMENT_MASTER_EVIDENCE_REQUIRED');
    }
    if (mode === 'AIR') {
      if (!String(input.airMawbReference ?? '').trim()) blockers.push('AIR_MAWB_REFERENCE_REQUIRED');
      if (input.attemptedStockGenerateMawb === true) {
        blockers.push('AIR_MAWB_STOCK_GENERATE_FORBIDDEN');
      }
    }
    return { allowed: blockers.length === 0, blockers };
  }
  const blockers: string[] = [];
  if (input.roadRailMasterMapped !== true) {
    blockers.push('ROAD_RAIL_MASTER_MAPPING_REQUIRED');
  }
  if (!String(input.roadRailMasterMappingEvidenceRef ?? '').trim()) {
    blockers.push('ROAD_RAIL_MASTER_MAPPING_EVIDENCE_REQUIRED');
  }
  return { allowed: blockers.length === 0, blockers };
}

/** Mobile API path helper ΓÇö Courier API only. */
export function buildMovementMasterLinkPath(): string {
  return '/movement-master/links';
}
