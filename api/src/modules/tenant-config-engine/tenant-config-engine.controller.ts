/**
 * TenantConfigEngineController
 * Phase 5 C1: 8 endpoints ΓÇö Business Profile + Capability Registry + Capability Config
 * DOC-000088 S2, S5.1-S5.3, S6.1
 */
import {  Controller, Get, Post, Put, Patch, Body, Query, Headers , Param } from '@nestjs/common';
import { TenantConfigEngineService } from './tenant-config-engine.service';
import { DynamicMenuEnforcementService } from '../../kernel/dynamic-menu-enforcement.service';
import { UIDesignSystemEnforcementService } from '../../kernel/ui-design-system-enforcement.service';
import { GovernanceInvariantEnforcementService } from '../../kernel/governance-invariant-enforcement.service';
import { CapabilityPlanBoundaryEnforcementService } from '../../kernel/capability-plan-boundary-enforcement.service';
import { OperationalSurfaceEnforcementService } from '../../kernel/operational-surface-enforcement.service';
import { RequireCapability } from './require-capability.decorator';
import { TenantPermissionEnforcementService } from './tenant-permission-enforcement.service';

@Controller('tenant-config-engine')
export class TenantConfigEngineController {
  constructor(private readonly svc: TenantConfigEngineService, private readonly menuEnforcement: DynamicMenuEnforcementService, private readonly uiEnforcement: UIDesignSystemEnforcementService, private readonly govEnforcement: GovernanceInvariantEnforcementService, private readonly boundaryEnforcement: CapabilityPlanBoundaryEnforcementService, private readonly opsEnforcement: OperationalSurfaceEnforcementService, private readonly permEnforcement: TenantPermissionEnforcementService) {}

  // ΓöÇΓöÇ Business Profile ΓöÇΓöÇ
  @Get('business-profile') async getProfile(@Headers('x-tenant-id') t: string) { return this.svc.getBusinessProfile(t); }
  @RequireCapability('TENANT_CONFIG_BUSINESS_PROFILE', 'canConfigure')
  @Put('business-profile') async upsertProfile(@Headers('x-tenant-id') t: string, @Body() dto: { primaryBusinessCategory: string; industryVertical: string; businessModel: string; operatingModel: string; salesModel: string; customerModel: string; branchModel: string; fieldOperationRequired?: boolean; inventoryRequired?: boolean; logisticsRequired?: boolean; manufacturingRequired?: boolean; projectRequired?: boolean; retailRequired?: boolean; serviceRequired?: boolean; procurementRequired?: boolean; financeRequired?: boolean; hrmsRequired?: boolean; complianceLevel?: string; approvalMaturity?: string; planTier: string; maturityLevel?: string; }) { return this.svc.upsertBusinessProfile(t, dto); }

  // ΓöÇΓöÇ Capability Registry (platform-level) ΓöÇΓöÇ
  @Get('registry') async listRegistry(@Query('moduleCode') m?: string, @Query('capabilityType') t?: string) { return this.svc.listCapabilityRegistry(m, t); }
  @RequireCapability('TENANT_CONFIG_CAPABILITY_REGISTRY', 'canConfigure')
  @Post('registry') async registerCap(@Body() dto: { capabilityCode: string; capabilityName: string; capabilityDescription: string; moduleCode: string; parentMenuCode?: string; childMenuCode?: string; capabilityType: string; defaultEnabled?: boolean; requiredPlan?: string; applicableBusinessCategories?: string[]; applicableIndustries?: string[]; applicableBusinessModels?: string[]; applicableOperatingModels?: string[]; isCore?: boolean; isConfigurableCore?: boolean; isBusinessTypeExtension?: boolean; isIndustryExtension?: boolean; isSharedPlatformCapability?: boolean; isPlanControlled?: boolean; isRoleControlled?: boolean; displayOrder?: number; }) { return this.svc.registerPlatformCapability(dto); }

  // ΓöÇΓöÇ Tenant Capability Config ΓöÇΓöÇ
  @Get('capabilities') async listCaps(@Headers('x-tenant-id') t: string, @Query('enabledOnly') e?: string) { return this.svc.listTenantCapabilities(t, e === 'true'); }
  @Post('capabilities/toggle') async toggleCap(@Headers('x-tenant-id') t: string, @Body() dto: { capabilityCode: string; enabled: boolean; labelOverride?: string; displayOrder?: number; }) { return this.svc.toggleTenantCapability(t, 'SYSTEM', dto); }

  // ΓöÇΓöÇ Resolved view (DOC-000088 S6.1) ΓöÇΓöÇ
  @Get('resolved') async getResolved(@Headers('x-tenant-id') t: string) { return this.svc.getResolvedCapabilities(t); }

  // ΓöÇΓöÇ Enum reference (frontend dropdown population) ΓöÇΓöÇ
  @Get('enums') async getEnums() {
    return {
      primaryBusinessCategory: ['LOGISTICS','SERVICES','TRADING','MANUFACTURING','DISTRIBUTION','RETAIL','AGENCY','PROFESSIONAL_SERVICES','FIELD_OPERATIONS','ECOMMERCE','MULTI_BRANCH','OTHER'],
      industryVertical: ['PHARMA','MEDICAL_DEVICES','ELECTRONICS','FMCG','APPAREL','LEGAL_SERVICES','MARKETING_AGENCY','COURIER','FREIGHT','WAREHOUSING','MANUFACTURING','RETAIL','HEALTHCARE','EDUCATION','REAL_ESTATE','CONSTRUCTION','OTHER'],
      businessModel: ['B2B','B2C','D2C','B2B2C','MARKETPLACE','DISTRIBUTOR','SERVICE_PROVIDER','MANUFACTURER','TRADER','AGENCY','FRANCHISE','HYBRID'],
      operatingModel: ['SINGLE_BRANCH','MULTI_BRANCH','FIELD_TEAM','WAREHOUSE_LED','PROJECT_LED','SERVICE_LED','PRODUCTION_LED','RETAIL_LED','LOGISTICS_LED','REMOTE_DISTRIBUTED','HYBRID'],
      salesModel: ['LEAD_BASED','INQUIRY_BASED','RFQ_BASED','WALK_IN','RECURRING_ACCOUNT','SUBSCRIPTION_BASED','TENDER_BASED','DEALER_LED','CHANNEL_LED','DIRECT_SALES','ONLINE_SALES'],
      customerModel: ['INDIVIDUAL','COMPANY','DEALER','VENDOR','FRANCHISE','CHANNEL_PARTNER','SHIPPER','CONSIGNEE','CLIENT','TENANT','MEMBER','PATIENT','STUDENT','OTHER'],
      branchModel: ['SINGLE_LOCATION','REGIONAL_BRANCHES','FRANCHISE_BRANCHES','WAREHOUSES','HUBS','SERVICE_CENTERS','RETAIL_STORES','FIELD_OFFICES'],
      complianceLevel: ['BASIC','STANDARD','REGULATED','AUDIT_HEAVY'],
      approvalMaturity: ['NO_APPROVAL','SIMPLE_APPROVAL','MAKER_CHECKER','MULTI_LEVEL','MATRIX_APPROVAL'],
      maturityLevel: ['BASIC','STANDARD','ADVANCED','ENTERPRISE'],
      capabilityType: ['CORE_BOS','CONFIGURABLE_CORE','BUSINESS_TYPE_EXTENSION','INDUSTRY_EXTENSION','SHARED_PLATFORM','PLAN_CONTROLLED','ROLE_CONTROLLED'],
    };
  }

  // ΓöÇΓöÇ Menu Config (DOC-000088 S5.4) ΓöÇΓöÇ
  @Get('menu-tree') async getMenuTree(@Headers('x-tenant-id') t: string) { return this.svc.getTenantMenuTree(t); }
  @Post('menu') async upsertMenu(@Headers('x-tenant-id') t: string, @Body() dto: { menuCode: string; parentMenuCode?: string; moduleCode: string; enabled?: boolean; displayName: string; labelOverride?: string; displayOrder?: number; icon?: string; roleVisibility?: string[]; planVisibility?: string[]; capabilityDependency?: string; routePath?: string; isSection?: boolean; }) { return this.svc.upsertMenuConfig(t, dto); }

  // ΓöÇΓöÇ Field Config (DOC-000088 S5.5) ΓöÇΓöÇ
  // Fields endpoints moved to TenantFieldConfigController


  // ΓöÇΓöÇ Status Config (DOC-000088 S5.6) ΓöÇΓöÇ
  @Get('statuses') async listStatuses(@Headers('x-tenant-id') t: string, @Query('moduleCode') m: string, @Query('entityCode') e: string) { return this.svc.listStatusConfigs(t, m, e); }
  @Post('statuses') async upsertStatus(@Headers('x-tenant-id') t: string, @Body() dto: { moduleCode: string; entityCode: string; statusCode: string; statusLabel: string; statusOrder?: number; isInitialStatus?: boolean; isFinalStatus?: boolean; allowedTransitions?: string[]; statusColor?: string; statusIcon?: string; roleVisibility?: string[]; }) { return this.svc.upsertStatusConfig(t, dto); }

  // ΓöÇΓöÇ Workflow Config (DOC-000088 S5.7) ΓöÇΓöÇ
  @Get('workflows') async listWorkflows(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listTenantWorkflowConfigs(t, m); }
  @Post('workflows') async upsertWorkflow(@Headers('x-tenant-id') t: string, @Body() dto: { workflowCode: string; workflowName: string; moduleCode: string; enabled?: boolean; workflowSteps?: Record<string, unknown>[]; triggerRules?: Record<string, unknown>[]; transitionRules?: Record<string, unknown>[]; exceptionRules?: Record<string, unknown>[]; escalationRules?: Record<string, unknown>[]; slaSeconds?: number; ownerRole?: string; }) { return this.svc.upsertWorkflowConfig(t, dto); }

  // ΓöÇΓöÇ Approval Matrix (DOC-000088 S5.8) ΓöÇΓöÇ
  @Get('approvals') async listApprovals(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listApprovalMatrices(t, m); }
  @Post('approvals') async upsertApproval(@Headers('x-tenant-id') t: string, @Body() dto: { approvalCode: string; approvalName: string; moduleCode: string; enabled?: boolean; approvalLevels?: Record<string, unknown>[]; approvalConditions?: Record<string, unknown>[]; escalationRules?: Record<string, unknown>[]; deviationRules?: Record<string, unknown>[]; maxApprovalTimeHrs?: number; autoEscalate?: boolean; }) { return this.svc.upsertApprovalMatrix(t, dto); }

  // ΓöÇΓöÇ Report Config (DOC-000088 S5.9) ΓöÇΓöÇ
  @Get('reports') async listReports(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listReportConfigs(t, m); }
  @Post('reports') async upsertReport(@Headers('x-tenant-id') t: string, @Body() dto: { reportCode: string; reportLabel: string; moduleCode: string; enabled?: boolean; dataScope: string; filters?: Record<string, unknown>; roleVisibility?: string[]; planVisibility?: string[]; reportType?: string; defaultSortField?: string; defaultSortOrder?: string; exportFormats?: string[]; schedulable?: boolean; }) { return this.svc.upsertReportConfig(t, dto); }

  // ΓöÇΓöÇ Integration Config (DOC-000088 S5.11) ΓöÇΓöÇ
  @Get('integrations') async listIntegrations(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listIntegrationConfigs(t, m); }
  @Post('integrations') async upsertIntegration(@Headers('x-tenant-id') t: string, @Body() dto: { integrationCode: string; moduleCode: string; enabled?: boolean; requiredPlan?: string; credentialsReference?: string; webhookConfig?: Record<string, unknown>; apiPermissionScope?: string[]; syncDirection?: string; syncFrequencyMinutes?: number; }) { return this.svc.upsertIntegrationConfig(t, 'SYSTEM', dto); }

  // ΓöÇΓöÇ Role Permission (DOC-000088 S5.12) ΓöÇΓöÇ
  @Get('role-permissions') async listRolePerms(@Headers('x-tenant-id') t: string, @Query('roleId') r?: string, @Query('moduleCode') m?: string) { return this.svc.listRolePermissions(t, r, m); }
  @Post('role-permissions') async upsertRolePerm(@Headers('x-tenant-id') t: string, @Body() dto: { roleId: string; moduleCode: string; menuCode?: string; capabilityCode?: string; canView?: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; canApprove?: boolean; canExport?: boolean; canConfigure?: boolean; dataScope?: string; branchScope?: string[]; }) { return this.svc.upsertRolePermission(t, 'SYSTEM', dto); }

  // ΓöÇΓöÇ Resolved Menu Tree (DOC-000088 S6.1 full algorithm) ΓöÇΓöÇ
  // Filters by: enabled + capability dependency + plan visibility + role visibility
  // Applies label overrides. Returns parent-child tree.
  @Get('resolved-menu') async getResolvedMenu(
    @Headers('x-tenant-id') t: string,
    @Query('role') role?: string,
    @Query('plan') plan?: string,
  ) { return this.svc.getResolvedMenuTree(t, role || 'TENANT_ADMIN', plan || 'TENEX_CORE'); }

  // ΓöÇΓöÇ T01 Gap 1: Profile Versions ΓöÇΓöÇ
  @Get('profile-versions')
  async listProfileVersions(@Headers('x-tenant-id') t: string) { return this.svc.listProfileVersions(t); }

  // ΓöÇΓöÇ T01 Gap 2: Entitlement Snapshots ΓöÇΓöÇ
  @Get('entitlement-snapshots')
  async listEntitlementSnapshots(@Headers('x-tenant-id') t: string) { return this.svc.listEntitlementSnapshots(t); }

  // ΓöÇΓöÇ T01 Gap 7: Automation Config ΓöÇΓöÇ
  @Get('automation-configs')
  async listAutomationConfigs(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listAutomationConfigs(t, m); }

  @Post('automation-configs')
  async upsertAutomationConfig(@Headers('x-tenant-id') t: string, @Body() dto: { automationCode: string; automationName: string; moduleCode: string; triggerEvent: string; actionType: string; conditions?: Record<string, unknown>; actionPayload?: Record<string, unknown>; enabled?: boolean; requiredPlan?: string; }) { return this.svc.upsertAutomationConfig(t, dto); }

  // ΓöÇΓöÇ T01 Gap 8: Integration Sync Logs ΓöÇΓöÇ
  @Get('integration-sync-logs')
  async listIntegrationSyncLogs(@Headers('x-tenant-id') t: string, @Query('integrationCode') ic?: string) { return this.svc.listIntegrationSyncLogs(t, ic); }

  // ΓöÇΓöÇ T01 Gap 8: AI Decision Logs ΓöÇΓöÇ
  @Get('ai-decision-logs')
  async listAIDecisionLogs(@Headers('x-tenant-id') t: string, @Query('agentCode') ac?: string) { return this.svc.listAIDecisionLogs(t, ac); }

  // ΓöÇΓöÇ T01 Gap 9: Config Change Audit Trail ΓöÇΓöÇ
  @Get('config-audit-trail')
  async listConfigAuditTrail(@Headers('x-tenant-id') t: string, @Query('objectType') ot?: string) { return this.svc.listConfigChangeLog(t, ot); }

  @Get('sla-configs') async listSLAs(@Headers('x-tenant-id') t: string, @Query('moduleCode') m?: string) { return this.svc.listSLAConfigs(t, m); }
  @Post('sla-configs') async upsertSLA(@Headers('x-tenant-id') t: string, @Body() dto: { slaCode: string; moduleCode: string; slaName: string; slaType?: string; targetValueMinutes: number; warningThresholdPct?: number; breachAction?: string; escalationRoleId?: string; appliesTo?: string; appliesToFilter?: Record<string, unknown>; priority?: string; enabled?: boolean }) { return this.svc.upsertSLAConfig(t, 'SYSTEM', dto); }

  // ΓöÇΓöÇ CL-B01: Menu Configuration Endpoints (DOC-000061) ΓöÇΓöÇ
  @Post('menu-seed')
  async seedMenuDefaults(@Headers('x-tenant-id') t: string, @Body() dto?: { planCode?: string }) {
    return this.menuEnforcement.seedAllModuleMenus(t, (dto && dto.planCode) || 'TENEX_CORE', 'SYSTEM');
  }

  @Get('menu-visibility')
  async getMenuVisibility(@Headers('x-tenant-id') t: string) {
    return this.svc.getMenuVisibilityRules(t);
  }

  @Patch('menu-visibility')
  async updateMenuVisibility(@Headers('x-tenant-id') t: string, @Body() dto: { menuCode: string; visible: boolean }) {
    return this.svc.updateMenuVisibility(t, 'SYSTEM', dto.menuCode, dto.visible);
  }

  @Get('menu-hierarchy')
  async getMenuHierarchy(@Headers('x-tenant-id') t: string) {
    return this.svc.getMenuHierarchy(t);
  }

  @Get('back-navigation')
  async getBackNavigation(@Headers('x-tenant-id') t: string) {
    return this.svc.getBackNavigationConfig(t);
  }

  // ΓöÇΓöÇ P0-S7 C1: Module Access Enforcement Matrix (DOC-000088 S6.3) ΓöÇΓöÇ
  @Get('enforcement-matrix')
  async getEnforcementMatrix(
    @Headers('x-tenant-id') t: string,
    @Query('role') role?: string,
    @Query('plan') plan?: string,
  ) { return this.menuEnforcement.getEnforcementMatrix(t, role || 'TENANT_ADMIN', plan || 'TENEX_CORE'); }

  @Get('enforce-module')
  async enforceModule(
    @Headers('x-tenant-id') t: string,
    @Query('moduleCode') moduleCode: string,
    @Query('role') role?: string,
    @Query('plan') plan?: string,
  ) { return this.menuEnforcement.enforceModuleAccess({ tenantId: t, moduleCode, userRole: role || 'TENANT_ADMIN', planCode: plan || 'TENEX_CORE' }); }

  @Get('enforce-menu-item')
  async enforceMenuItem(
    @Headers('x-tenant-id') t: string,
    @Query('menuCode') menuCode: string,
    @Query('role') role?: string,
    @Query('plan') plan?: string,
  ) { return this.menuEnforcement.enforceMenuItemAccess(t, menuCode, role || 'TENANT_ADMIN', plan || 'TENEX_CORE'); }

  // ΓöÇΓöÇ P0-S7 C2: UI Design System Enforcement (DOC-000061 S4, S13) ΓöÇΓöÇ
  @Get('ui-rules')
  async getUIRules() { return this.uiEnforcement.getAllRules(); }

  @Get('color-tokens')
  async getColorTokens() { return this.uiEnforcement.getColorTokenRegistry(); }

  @Get('mandatory-components')
  async getMandatoryComponents() { return this.uiEnforcement.getMandatoryComponents(); }

  @Post('ui-audit')
  async auditScreen(@Headers('x-tenant-id') t: string, @Body() dto: {
    screenId: string; screenName: string; hasKeyboardNav: boolean; actionCount: number;
    iconsHaveLabels: boolean; formInputsHaveLabels: boolean; usesDesignTokens: boolean;
    hasInlineHexColors: boolean; usesComponentLibrary: boolean; hasInlineStyles: boolean;
    aiSuggestionsHaveAcceptDismiss: boolean; hasAISuggestions: boolean;
    primaryInfoClear: boolean; secondaryInfoQuieter: boolean; tertiaryInfoAccessible: boolean;
    hasEmptyState: boolean; hasLoadingState: boolean; hasErrorState: boolean;
  }) { return this.uiEnforcement.auditScreen(t, dto); }

  // ΓöÇΓöÇ P0-S7 C3: Governance Invariant Enforcement (DOC-000023) ΓöÇΓöÇ
  @Get('governance-rules')
  async getGovernanceRules() { return this.govEnforcement.getAllRules(); }

  @Post('governance-check')
  async governanceCheck(@Headers('x-tenant-id') t: string, @Body() dto: {
    actorId: string; action: string;
    hasConflict?: boolean; hasNamespaceCollision?: boolean; requiresOperatorDebug?: boolean;
    hasPerfDegradation?: boolean; hasRollbackPlan?: boolean; hasQuantitativeProof?: boolean;
    hasAmbiguity?: boolean; compromisesInvariant?: boolean; forksKernel?: boolean;
    hasSLODeclared?: boolean; isIrreversible?: boolean; hasCEOApproval?: boolean;
  }) { return this.govEnforcement.enforceAll({ tenantId: t, ...dto }); }

  @Post('governance-check-single')
  async governanceCheckSingle(@Headers('x-tenant-id') t: string, @Body() dto: {
    ruleCode: string; actorId: string; action: string;
    hasConflict?: boolean; hasNamespaceCollision?: boolean; requiresOperatorDebug?: boolean;
    hasPerfDegradation?: boolean; hasRollbackPlan?: boolean; hasQuantitativeProof?: boolean;
    hasAmbiguity?: boolean; compromisesInvariant?: boolean; forksKernel?: boolean;
    hasSLODeclared?: boolean; isIrreversible?: boolean; hasCEOApproval?: boolean;
  }) { return this.govEnforcement.enforceRule(dto.ruleCode, { tenantId: t, ...dto }); }

  // ΓöÇΓöÇ P0-S7 C4: Capability/Plan Boundary Enforcement ΓöÇΓöÇ
  @Get('boundary-rules')
  async getBoundaryRules() { return this.boundaryEnforcement.getAllRules(); }

  @Post('boundary-check')
  async boundaryCheck(@Headers('x-tenant-id') t: string, @Body() dto: {
    actorId: string; action: string; currentGS?: number; targetGS?: number;
    altersExistingMeaning?: boolean; capabilityGrade?: string; workflowBypassAttempt?: boolean;
    planCode?: string; exclusionsExplicit?: boolean; inclusionsExplicit?: boolean;
    hasTenantBinding?: boolean; isPickupFlow?: boolean; pgExtensionsPresent?: string[];
    isLEKBound?: boolean; hasCohortDeclaration?: boolean; slaParties?: string[];
    hasLineagePreserved?: boolean; hasGradeAorB?: boolean;
  }) { return this.boundaryEnforcement.enforceAll({ tenantId: t, ...dto }); }

  // ΓöÇΓöÇ P0-S7 C5: Dashboard Definitions ΓöÇΓöÇ
  @Get('dashboard-definitions')
  async getDashboardDefs() { return this.opsEnforcement.getDashboardDefinitions(); }

  // ΓöÇΓöÇ P0-S7 C6: Operational Surface Enforcement ΓöÇΓöÇ
  @Get('ops-rules')
  async getOpsRules() { return this.opsEnforcement.getAllRules(); }

  @Post('ops-check')
  async opsCheck(@Headers('x-tenant-id') t: string, @Body() dto: {
    actorId: string; action: string; preservesBoundary?: boolean; hasCustomerTenantUI?: boolean;
    requiresNewInstrumentation?: boolean; hasDigitalSurface?: boolean; hasBilingualSignoff?: boolean;
    extraCareHandlingMinutes?: number; handoffPartiesKnown?: boolean; hardwareTenantMaintained?: boolean;
    physicalInstallTenantResponsibility?: boolean; communicationsAsSubmenu?: boolean; hasSLAPerTicket?: boolean;
    methodologyAddendaApplied?: boolean; moduleNamesNormalized?: boolean; hasImplementationArtifacts?: boolean;
    qmsDefineInspectLogFlow?: boolean; logisticsProcessCompliant?: boolean; tenantSealingSnapshotExists?: boolean;
    requiredDocumentRulesDefined?: boolean; requiredDocumentSetComplete?: boolean; requiredDocumentsForOnboarding?: boolean;
    noPaymentRequired?: boolean; environmentEligibilityStated?: boolean; translationI18NReady?: boolean;
  }) { return this.opsEnforcement.enforceAll({ tenantId: t, ...dto }); }

  // === S10-G: Config Engine endpoints ===
  @Post('workflow-permission-check')
  async workflowPermCheck(@Headers('x-tenant-id') t: string, @Body() dto: { userId: string; workflowStep: string }) {
    return this.permEnforcement.checkWorkflowStepPermission(t, dto);
  }

  @Post('backend-permission-enforce')
  async backendPermEnforce(@Headers('x-tenant-id') t: string, @Body() dto: { userId: string; moduleCode: string; action: string }) {
    return this.permEnforcement.enforceBackendModulePermission(t, dto);
  }

  @Get('status-dropdown/:entityType')
  async statusDropdown(@Headers('x-tenant-id') t: string, @Param('entityType') et: string) {
    return this.svc.getStatusDropdown(t, et);
  }

  @Get('tenant-workflows')
  async tenantWorkflows(@Headers('x-tenant-id') t: string, @Query('moduleCode') mc?: string) {
    return this.svc.getTenantWorkflows(t, mc);
  }

  // #REQ_027AE9469E ΓÇö Module icons with labels
  @Get('menu-items-with-icons')
  async menuItemsWithIcons(@Headers('x-tenant-id') t: string) {
    return this.svc.getMenuItemsWithIcons(t);
  }
}
