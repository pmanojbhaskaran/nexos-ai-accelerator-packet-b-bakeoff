import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { evaluateProvisionalDimensions } from '../../common/bakeoff/dimension-quality-gate';
import { assertBakeoffDimensionCapability } from '../../common/bakeoff/bakeoff-capability';

@Injectable()
export class BakeoffDimensioningService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePackage(tenantId: string, barcode: string, _actorId: string) {
    await assertBakeoffDimensionCapability(this.prisma, tenantId);
    if (!tenantId || !barcode) throw new NotFoundException('PACKAGE_NOT_FOUND');
    const pkg = await this.prisma.shipmentPackage.findFirst({ where: { tenantId, packageBarcode: barcode } });
    if (!pkg) throw new NotFoundException('PACKAGE_NOT_FOUND');
    return { tenantId, packageId: pkg.id, barcode: pkg.packageBarcode, shipmentInternalId: pkg.shipmentInternalId };
  }

  async submitProvisional(tenantId: string, actorId: string, packageId: string, body: Record<string, unknown>) {
    await assertBakeoffDimensionCapability(this.prisma, tenantId);
    const pkg = await this.prisma.shipmentPackage.findFirst({ where: { id: packageId, tenantId } });
    if (!pkg) throw new NotFoundException('PACKAGE_NOT_FOUND');
    const gate = evaluateProvisionalDimensions({
      length: Number(body.length),
      width: Number(body.width),
      height: Number(body.height),
      confidence: body.confidence !== undefined ? Number(body.confidence) : undefined,
    });
    const decision = String(body.decision ?? gate.decision);
    const record = await this.prisma.packageDimensionCapture.create({
      data: {
        tenantId,
        shipmentId: pkg.shipmentInternalId,
        packageId: pkg.id,
        measurementSource: String(body.measurementSource ?? 'CAMERA_PROVISIONAL'),
        captureMethod: String(body.captureMethod ?? 'EXPO_CAMERA'),
        lengthCm: body.length as any,
        widthCm: body.width as any,
        heightCm: body.height as any,
        qualityResult: String(body.qualityResult ?? gate.qualityResult),
        confidence: body.confidence as any,
        decision,
        billingEligible: false,
        algorithmVersion: String(body.algorithmVersion ?? 'bakeoff-stub-0'),
        calibrationVersion: body.calibrationVersion ? String(body.calibrationVersion) : null,
        deviceId: String(body.deviceId ?? 'unknown-device'),
        capturedAt: new Date(String(body.capturedAt ?? new Date().toISOString())),
        capturedBy: actorId,
        evidenceRef: body.evidenceRef ? String(body.evidenceRef) : null,
        originalJson: body.original ?? null,
        acceptedJson: body.accepted ?? null,
        overrideReason: body.overrideReason ? String(body.overrideReason) : null,
        correlationId: String(body.correlationId ?? `corr_${Date.now()}`),
      },
    });
    await this.prisma.shipmentAuditEvent.create({
      data: {
        tenantId,
        eventName: 'bakeoff.package.dimension.provisional.v1',
        actorId,
        entityType: 'PackageDimensionCapture',
        entityId: record.id,
        correlationId: record.correlationId,
        payload: { decision, billingEligible: false },
        resultStatus: 'SUCCESS',
      },
    });
    await this.prisma.domainEventRecord.create({
      data: {
        tenantId,
        topic: 'bakeoff.package.dimension.provisional.v1',
        payload: { measurementId: record.id, packageId, decision, billingEligible: false },
        correlationId: record.correlationId,
      },
    });
    return { measurementId: record.id, billingEligible: false, decision, record };
  }

  async registerEvidence(tenantId: string, actorId: string, body: Record<string, unknown>) {
    await assertBakeoffDimensionCapability(this.prisma, tenantId);
    const artifact = await this.prisma.proofArtifact.create({
      data: {
        tenantId,
        entityType: String(body.entityType ?? 'PackageDimensionCapture'),
        entityId: String(body.entityId ?? 'unknown'),
        storageKey: String(body.storageKey ?? `local://${tenantId}/${Date.now()}`),
        contentType: String(body.contentType ?? 'image/jpeg'),
        capturedAt: new Date(),
        capturedBy: actorId,
      },
    });
    return { evidenceRef: artifact.id, artifact };
  }
}
