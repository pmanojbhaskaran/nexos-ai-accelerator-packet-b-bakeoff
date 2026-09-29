import { BakeoffDimensioningService } from '../../api/src/modules/bakeoff-dimensioning/bakeoff-dimensioning.service.ts';

export type PackageFixture = {
  id: string;
  packageBarcode: string;
  shipmentInternalId: string;
};

export type BakeoffFixtureStore = {
  packagesByTenantBarcode: Record<string, PackageFixture>;
  packagesByTenantId: Record<string, PackageFixture>;
  capabilityEnabled: Record<string, boolean>;
  prismaCalls: string[];
};

export function createBakeoffFixtureStore(initial?: Partial<BakeoffFixtureStore>): BakeoffFixtureStore {
  return {
    packagesByTenantBarcode: initial?.packagesByTenantBarcode ?? {},
    packagesByTenantId: initial?.packagesByTenantId ?? {},
    capabilityEnabled: initial?.capabilityEnabled ?? {
      TENANT_A_QA: true,
      TENANT_B_QA: true,
    },
    prismaCalls: [],
  };
}

export function createBakeoffService(store: BakeoffFixtureStore): BakeoffDimensioningService {
  const prisma = {
    tenantCapabilityConfig: {
      findFirst: async ({ where }: { where: { tenantId: string; capabilityCode: string } }) => {
        store.prismaCalls.push(`capability:${where.tenantId}:${where.capabilityCode}`);
        const enabled = store.capabilityEnabled[where.tenantId];
        if (enabled === undefined) return null;
        return { enabled };
      },
    },
    shipmentPackage: {
      findFirst: async ({ where }: { where: { tenantId?: string; packageBarcode?: string; id?: string } }) => {
        if (where.packageBarcode && where.tenantId) {
          return store.packagesByTenantBarcode[`${where.tenantId}:${where.packageBarcode}`] ?? null;
        }
        if (where.id && where.tenantId) {
          return store.packagesByTenantId[`${where.tenantId}:${where.id}`] ?? null;
        }
        return null;
      },
    },
    packageDimensionCapture: {
      create: async (args: unknown) => {
        store.prismaCalls.push('packageDimensionCapture.create');
        return { id: 'meas-1', correlationId: 'corr-1', ...(args as object) };
      },
    },
    shipmentAuditEvent: {
      create: async () => {
        store.prismaCalls.push('shipmentAuditEvent.create');
        return {};
      },
    },
    domainEventRecord: {
      create: async () => {
        store.prismaCalls.push('domainEventRecord.create');
        return {};
      },
    },
    proofArtifact: {
      create: async () => {
        store.prismaCalls.push('proofArtifact.create');
        return { id: 'proof-1' };
      },
    },
  };
  return new BakeoffDimensioningService(prisma as any);
}

export function packageNotFoundMessage(err: unknown): string {
  const e = err as {
    response?: { message?: string };
    message?: string;
    getResponse?: () => { message?: string; code?: string };
  };
  const payload = e.getResponse?.() ?? e.response;
  return String(payload?.message ?? e.message ?? '');
}

export function errorCode(err: unknown): string | undefined {
  const e = err as { getResponse?: () => { code?: string } };
  return e.getResponse?.()?.code;
}
