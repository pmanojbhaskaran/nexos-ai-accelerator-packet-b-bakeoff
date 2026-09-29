import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { assertBakeoffDimensionCapability, type BakeoffCapabilityReader } from './bakeoff-capability';

export const PACKET_B_PRIOR_STATE = 'HUB_INBOUND_RECORDED';
export const PACKET_B_RESULT_STATE = 'DIMENSION_PROVISIONAL_RECORDED';

export type PacketBTransitionInput = {
  tenantId: string;
  actorId: string;
  packageId: string;
  priorState: string;
  idempotencyKey: string;
  length: number;
  width: number;
  height: number;
};

export type PacketBPorts = BakeoffCapabilityReader & {
  shipmentPackage: {
    findFirst: (args: { where: { id: string; tenantId: string } }) => Promise<{ id: string; packageBarcode: string; shipmentInternalId: string } | null>;
  };
  hubInboundScan: {
    findFirst: (args: { where: { tenantId: string; barcodeValue: string } }) => Promise<{ id: string } | null>;
  };
  packageDimensionCapture: {
    findFirst: (args: { where: { tenantId: string; correlationId: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; correlationId: string }>;
  };
  shipmentAuditEvent: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
  domainEventRecord: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
  proofArtifact: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }> };
};

export async function applyPacketBOperationalTransition(
  _prisma: PacketBPorts,
  _input: PacketBTransitionInput,
) {
  /**
   * PACKET_B_CANDIDATE_IMPLEMENTATION_REQUIRED
   *
   * Implement the operational transition defined by:
   *   tests/packet-b/REQUIREMENTS.md
   *
   * Preserve the supplied NEXOS representative authorities and contracts.
   * Do not introduce a second database, authentication authority,
   * tenant authority, backend, or source of truth.
   *
   * Evaluator-owned tests determine acceptance.
   */
  return {
    ok: false,
    code: 'PACKET_B_IMPLEMENTATION_REQUIRED',
  };
}
export function diagnosePacketBCandidateCalls(calls: string[]) {
  if (!calls.includes('measurement') || !calls.includes('audit') || !calls.includes('domain')) {
    return { ok: false, code: 'NO_OP_CANDIDATE' };
  }
  return { ok: true, code: 'PACKET_B_TRANSITION_EXECUTED' };
}
