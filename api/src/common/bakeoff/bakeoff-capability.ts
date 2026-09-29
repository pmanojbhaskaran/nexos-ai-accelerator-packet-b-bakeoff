import { ForbiddenException } from '@nestjs/common';

export const BAKEOFF_DIMENSION_CAPABILITY = 'BAKEOFF_DIMENSION_CAPTURE';

export type BakeoffCapabilityReader = {
  tenantCapabilityConfig: {
    findFirst: (args: {
      where: { tenantId: string; capabilityCode: string };
    }) => Promise<{ enabled: boolean } | null>;
  };
};

/** Server-side capability gate for Packet B/C dimension paths (not UI-only). */
export async function assertBakeoffDimensionCapability(
  prisma: BakeoffCapabilityReader,
  tenantId: string,
): Promise<void> {
  const cfg = await prisma.tenantCapabilityConfig.findFirst({
    where: { tenantId, capabilityCode: BAKEOFF_DIMENSION_CAPABILITY },
  });
  if (!cfg?.enabled) {
    throw new ForbiddenException({
      code: 'CAPABILITY_NOT_ENABLED',
      message: `Capability ${BAKEOFF_DIMENSION_CAPABILITY} is not enabled for tenant`,
    });
  }
}
