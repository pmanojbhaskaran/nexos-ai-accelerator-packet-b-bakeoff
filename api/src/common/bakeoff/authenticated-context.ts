import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export type BakeoffAuthUser = {
  userId: string;
  tenantCode: string;
  displayName?: string;
  roles?: string[];
};

/** Tenant and actor MUST derive from JWT-validated principal; header is validated only. */
export function resolveAuthenticatedBakeoffContext(req: {
  user?: BakeoffAuthUser;
  headers?: Record<string, unknown>;
}): { tenantId: string; actorId: string } {
  const user = req.user;
  if (!user?.tenantCode || !user?.userId) {
    throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Authenticated principal required' });
  }
  const headerTenant = req.headers?.['x-tenant-id'];
  if (headerTenant !== undefined && headerTenant !== null && String(headerTenant).trim() !== '') {
    if (String(headerTenant).trim() !== user.tenantCode) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_MISMATCH', message: 'Tenant header does not match authenticated principal' });
    }
  }
  const headerActor = req.headers?.['x-actor-id'];
  if (headerActor !== undefined && headerActor !== null && String(headerActor).trim() !== '') {
    if (String(headerActor).trim() !== user.userId) {
      throw new ForbiddenException({ code: 'ACTOR_CONTEXT_MISMATCH', message: 'Actor header does not match authenticated principal' });
    }
  }
  return { tenantId: user.tenantCode, actorId: user.userId };
}
