/**
 * NEXOS shared contracts barrel export.
 * CAP-006: ShipmentCategory foundation.
 */
export {
  ShipmentCategory,
  SHIPMENT_CATEGORY_VALUES,
  validateShipmentCategory,
  isShipmentCategory,
  shipmentCategoryValidationError,
} from './shipment-category';
export * from './coloader-booking-config';
export * from './tenant-onboarding';
export * from './doc58-tenant-setup';
export * from './setup-workbench';
export * from './setup-workbench-operating-model';
export * from './setup-workbench-readiness';
export * from './setup-workforce';
export * from './setup-coverage-network';
export * from './setup-coverage-payload-migration';
export * from './setup-facility-nodes';
export * from './setup-own-assets';
export * from './setup-v11-closeout';
export * from './setup-dry-run-orchestrator';
export * from './setup-runtime-enforcement';
export * from './setup-runtime-projection';
export * from './setup-step-info-catalog';
export * from './setup-workspace-isolation-proof';
export * from './ops-exception-lifecycle';
export * from './movement-master-gates';
export * from './v0-readiness';
// setup-help-descriptors and ops-governance-gates are intentionally not barrel-exported until
// Mobile Shared file: link is refreshed via approved pnpm install.
// Import via relative path or package subpath './src/nexos/*'.
