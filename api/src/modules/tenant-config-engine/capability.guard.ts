/**
 * CapabilityGuard
 * Phase 5 C5+C6: DOC-000088 S6.3 / S12 -- Backend Enforcement Rules
 *
 * Runs on every API endpoint (registered as APP_GUARD). Validates:
 *   0. Skip @Public routes
 *   1. Skip if no @RequireCapability decorator (gradual adoption)
 *   2. Capability enabled for tenant (TenantCapabilityConfig)
 *   3. Default fallback (CapabilityRegistry.defaultEnabled)
 *   4. Plan entitlement (tenant plan tier vs required tier)
 *   5. Role permission (TenantRolePermission action flags) -- C6
 *
 * GS enforcement is handled separately by kernel GrowthStateGuard
 * with @MinGrowthState decorator (DOC-000022). No duplication here.
 *
 * Adyaya Solutions Private Limited
 */
import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../auth/jwt-auth.guard';
import { CAPABILITY_KEY, CapabilityMetadata, CapabilityAction } from './require-capability.decorator';
import { ERR } from '../../common/errors/codes';
import { forbidden } from '../../common/errors/http';

const PLAN_HIERARCHY: Record<string, number> = {
  TENEX_CORE: 1,
  TENEX_PRO: 2,
  TENEX_PLUS: 3,
  TENEX_360: 4,
};

/** Map HTTP method to default action when no explicit action in decorator */
const METHOD_TO_ACTION: Record<string, CapabilityAction> = {
  GET: 'canView',
  POST: 'canCreate',
  PUT: 'canEdit',
  PATCH: 'canEdit',
  DELETE: 'canDelete',
};

@Injectable()
export class CapabilityGuard implements CanActivate {
  private readonly logger = new Logger(CapabilityGuard.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 0: Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Step 1: Read decorator metadata
    const raw = this.reflector.getAllAndOverride<CapabilityMetadata | string>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!raw) return true;

    // Support both old string-only and new metadata format
    const meta: CapabilityMetadata =
      typeof raw === 'string' ? { capabilityCode: raw } : raw;
    const { capabilityCode, action } = meta;

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenant_id || request.headers?.['x-tenant-id'];
    if (!tenantId || String(tenantId).trim() === '') return true;
    const tid = String(tenantId).trim();

    // ΓöÇΓöÇ Check 1: Capability enabled ΓöÇΓöÇ
    const tenantConfig = await this.prisma.tenantCapabilityConfig.findFirst({
      where: { tenantId: tid, capabilityCode },
    });

    if (tenantConfig) {
      if (!tenantConfig.enabled) {
        this.logger.warn(`Capability ${capabilityCode} DISABLED for tenant ${tid}`);
        forbidden([{ code: ERR.CAPABILITY_NOT_ENABLED, message: `Capability ${capabilityCode} is not enabled for this tenant` }]);
      }
    } else {
      // ΓöÇΓöÇ Check 2: Fall back to registry default ΓöÇΓöÇ
      const registry = await this.prisma.capabilityRegistry.findFirst({
        where: { capabilityCode },
      });

      if (!registry) {
        this.logger.warn(`Capability ${capabilityCode} not in registry`);
        forbidden([{ code: ERR.CAPABILITY_NOT_ENABLED, message: `Capability ${capabilityCode} is not registered in the platform` }]);
      }

      if (!registry!.defaultEnabled) {
        // ΓöÇΓöÇ Check 3: Plan entitlement ΓöÇΓöÇ
        if (registry!.requiredPlan) {
          const sub = await this.prisma.subscription.findFirst({
            where: { tenantId: tid, status: { in: ['ACTIVE', 'TRIAL'] } },
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
          });

          if (sub?.plan) {
            const tenantLevel = PLAN_HIERARCHY[sub.plan.productCode || ''] || 0;
            const requiredLevel = PLAN_HIERARCHY[registry!.requiredPlan] || 0;
            if (tenantLevel >= requiredLevel) {
              // Plan sufficient ΓÇö continue to role check
            } else {
              forbidden([{
                code: ERR.PLAN_ENTITLEMENT_REQUIRED,
                message: `Capability ${capabilityCode} requires plan ${registry!.requiredPlan} or higher. Current: ${sub.plan.productCode}`,
              }]);
            }
          } else {
            forbidden([{
              code: ERR.PLAN_ENTITLEMENT_REQUIRED,
              message: `Capability ${capabilityCode} requires plan ${registry!.requiredPlan}`,
            }]);
          }
        } else {
          forbidden([{ code: ERR.CAPABILITY_NOT_ENABLED, message: `Capability ${capabilityCode} is not enabled for this tenant` }]);
        }
      }
    }

    // ΓöÇΓöÇ Check 4 (C6): Role Permission ΓöÇΓöÇ
    const roleId = request.headers?.['x-role'] || request.auth_principal?.roleId || '';
    if (roleId && String(roleId).trim() !== '') {
      const rid = String(roleId).trim();
      const resolvedAction: CapabilityAction =
        action || METHOD_TO_ACTION[request.method?.toUpperCase()] || 'canView';

      // Look up TenantRolePermission for this tenant + role + capability
      const rolePerm = await this.prisma.tenantRolePermission.findFirst({
        where: {
          tenantId: tid,
          roleId: rid,
          capabilityCode,
        },
      });

      if (rolePerm) {
        const allowed = rolePerm[resolvedAction] as boolean;
        if (!allowed) {
          this.logger.warn(
            `Role ${rid} denied ${resolvedAction} on ${capabilityCode} for tenant ${tid}`,
          );
          forbidden([{
            code: ERR.ROLE_PERMISSION_DENIED,
            message: `Role ${rid} does not have ${resolvedAction} permission for ${capabilityCode}`,
          }]);
        }
      }
      // If no rolePerm row exists, allow through (permissions not yet configured = open)
    }
    // If no roleId on request, skip role check (role header not yet wired by caller)

    return true;
  }
}
