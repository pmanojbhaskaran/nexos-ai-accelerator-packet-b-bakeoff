/**
 * RequireCapability decorator
 * Phase 5 C5+C6: DOC-000088 S6.3/S12 -- Backend Enforcement
 *
 * Usage (capability check only):
 *   @RequireCapability('CRM_LEAD_MANAGEMENT')
 *
 * Usage (capability + action check):
 *   @RequireCapability('CRM_LEAD_MANAGEMENT', 'canCreate')
 *
 * The CapabilityGuard reads this metadata and checks:
 *   1. TenantCapabilityConfig.enabled
 *   2. Plan entitlement (CapabilityRegistry.requiredPlan)
 *   3. Role permission (TenantRolePermission action flags) -- C6
 *
 * Valid actions: canView, canCreate, canEdit, canDelete, canApprove, canExport, canConfigure
 *
 * Adyaya Solutions Private Limited
 */
import { SetMetadata } from '@nestjs/common';

export const CAPABILITY_KEY = 'required_capability';

export type CapabilityAction =
  | 'canView'
  | 'canCreate'
  | 'canEdit'
  | 'canDelete'
  | 'canApprove'
  | 'canExport'
  | 'canConfigure';

export interface CapabilityMetadata {
  capabilityCode: string;
  action?: CapabilityAction;
}

export const RequireCapability = (
  capabilityCode: string,
  action?: CapabilityAction,
) => SetMetadata(CAPABILITY_KEY, { capabilityCode, action } as CapabilityMetadata);
