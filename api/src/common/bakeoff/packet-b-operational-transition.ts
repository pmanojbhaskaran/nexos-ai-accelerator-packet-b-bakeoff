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

export async function applyPacketBOperationalTransition(prisma: PacketBPorts, input: PacketBTransitionInput) {
  await assertBakeoffDimensionCapability(prisma, input.tenantId);
  if (!input.actorId) {
    throw new ForbiddenException({ code: 'AUTH_REQUIRED', message: 'Authenticated actor required' });
  }
  if (input.priorState !== PACKET_B_PRIOR_STATE) {
    throw new BadRequestException({ code: 'INVALID_STATE_TRANSITION', message: 'Prior state must be HUB_INBOUND_RECORDED' });
  }
  const pkg = await prisma.shipmentPackage.findFirst({ where: { id: input.packageId, tenantId: input.tenantId } });
  if (!pkg) throw new NotFoundException('PACKAGE_NOT_FOUND');
  const scan = await prisma.hubInboundScan.findFirst({ where: { tenantId: input.tenantId, barcodeValue: pkg.packageBarcode } });
  if (!scan) {
    throw new BadRequestException({ code: 'INVALID_STATE_TRANSITION', message: 'Hub inbound scan required before dimension transition' });
  }
  const existing = await prisma.packageDimensionCapture.findFirst({
    where: { tenantId: input.tenantId, correlationId: input.idempotencyKey },
  });
  if (existing) {
    return {
      duplicate: true,
      measurementId: existing.id,
      priorState: PACKET_B_PRIOR_STATE,
      resultingState: PACKET_B_RESULT_STATE,
      billingEligible: false,
    };
  }
  const record = await prisma.packageDimensionCapture.create({
    data: {
      tenantId: input.tenantId,
      shipmentId: pkg.shipmentInternalId,
      packageId: pkg.id,
      lengthCm: input.length,
      widthCm: input.width,
      heightCm: input.height,
      billingEligible: false,
      capturedBy: input.actorId,
      correlationId: input.idempotencyKey,
      decision: 'PROVISIONAL',
    },
  });
  await prisma.proofArtifact.create({
    data: { tenantId: input.tenantId, entityId: record.id, capturedBy: input.actorId },
  });
  await prisma.shipmentAuditEvent.create({
    data: { tenantId: input.tenantId, actorId: input.actorId, entityId: record.id, correlationId: input.idempotencyKey },
  });
  await prisma.domainEventRecord.create({
    data: { tenantId: input.tenantId, correlationId: input.idempotencyKey, payload: { measurementId: record.id } },
  });
  return {
    duplicate: false,
    measurementId: record.id,
    priorState: PACKET_B_PRIOR_STATE,
    resultingState: PACKET_B_RESULT_STATE,
    billingEligible: false,
  };
}

export function diagnosePacketBCandidateCalls(calls: string[]) {
  if (!calls.includes('measurement') || !calls.includes('audit') || !calls.includes('domain')) {
    return { ok: false, code: 'NO_OP_CANDIDATE' };
  }
  return { ok: true, code: 'PACKET_B_TRANSITION_EXECUTED' };
}
