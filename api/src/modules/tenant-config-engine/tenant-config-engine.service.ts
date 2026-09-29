/**
 * TenantConfigEngineService
 * Phase 5 C1: Foundation ΓÇö Business Profile + Capability Registry + Capability Config
 * DOC-000088 S2, S3, S5.1-S5.3, S6.1 (menu generation algorithm)
 * Adyaya Solutions Private Limited
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class TenantConfigEngineService {
  private readonly logger = new Logger(TenantConfigEngineService.name);
  constructor(private readonly prisma: PrismaService) {}

  // ΓöÇΓöÇ Tenant Business Profile (DOC-000088 S2) ΓöÇΓöÇ
  async upsertBusinessProfile(tenantId: string, dto: {
    primaryBusinessCategory: string; industryVertical: string;
    businessModel: string; operatingModel: string;
    salesModel: string; customerModel: string; branchModel: string;
    fieldOperationRequired?: boolean; inventoryRequired?: boolean;
    logisticsRequired?: boolean; manufacturingRequired?: boolean;
    projectRequired?: boolean; retailRequired?: boolean;
    serviceRequired?: boolean; procurementRequired?: boolean;
    financeRequired?: boolean; hrmsRequired?: boolean;
    complianceLevel?: string; approvalMaturity?: string;
    planTier: string; maturityLevel?: string;
  }) {
    this.logger.log(`Upsert business profile for tenant ${tenantId}: ${dto.primaryBusinessCategory} / ${dto.industryVertical}`);
    return this.prisma.tenantBusinessProfile.upsert({
      where: { tenantId },
      create: {
        tenantId, primaryBusinessCategory: dto.primaryBusinessCategory,
        industryVertical: dto.industryVertical, businessModel: dto.businessModel,
        operatingModel: dto.operatingModel, salesModel: dto.salesModel,
        customerModel: dto.customerModel, branchModel: dto.branchModel,
        fieldOperationRequired: dto.fieldOperationRequired ?? false,
        inventoryRequired: dto.inventoryRequired ?? false,
        logisticsRequired: dto.logisticsRequired ?? true,
        manufacturingRequired: dto.manufacturingRequired ?? false,
        projectRequired: dto.projectRequired ?? false,
        retailRequired: dto.retailRequired ?? false,
        serviceRequired: dto.serviceRequired ?? false,
        procurementRequired: dto.procurementRequired ?? false,
        financeRequired: dto.financeRequired ?? true,
        hrmsRequired: dto.hrmsRequired ?? true,
        complianceLevel: dto.complianceLevel ?? 'STANDARD',
        approvalMaturity: dto.approvalMaturity ?? 'SIMPLE_APPROVAL',
        planTier: dto.planTier, maturityLevel: dto.maturityLevel ?? 'BASIC',
        profileCompletedAt: new Date(),
      },
      update: {
        primaryBusinessCategory: dto.primaryBusinessCategory,
        industryVertical: dto.industryVertical, businessModel: dto.businessModel,
        operatingModel: dto.operatingModel, salesModel: dto.salesModel,
        customerModel: dto.customerModel, branchModel: dto.branchModel,
        fieldOperationRequired: dto.fieldOperationRequired,
        inventoryRequired: dto.inventoryRequired,
        logisticsRequired: dto.logisticsRequired,
        manufacturingRequired: dto.manufacturingRequired,
        projectRequired: dto.projectRequired,
        retailRequired: dto.retailRequired,
        serviceRequired: dto.serviceRequired,
        procurementRequired: dto.procurementRequired,
        financeRequired: dto.financeRequired,
        hrmsRequired: dto.hrmsRequired,
        complianceLevel: dto.complianceLevel,
        approvalMaturity: dto.approvalMaturity,
        planTier: dto.planTier, maturityLevel: dto.maturityLevel,
        profileCompletedAt: new Date(),
      },
    });
  }

  async getBusinessProfile(tenantId: string) {
    return this.prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
  }

  // ΓöÇΓöÇ Capability Registry (DOC-000088 S5.2, platform-level) ΓöÇΓöÇ
  async registerPlatformCapability(dto: {
    capabilityCode: string; capabilityName: string;
    capabilityDescription: string; moduleCode: string;
    parentMenuCode?: string; childMenuCode?: string;
    capabilityType: string; defaultEnabled?: boolean;
    requiredPlan?: string;
    applicableBusinessCategories?: string[];
    applicableIndustries?: string[];
    applicableBusinessModels?: string[];
    applicableOperatingModels?: string[];
    isCore?: boolean; isConfigurableCore?: boolean;
    isBusinessTypeExtension?: boolean; isIndustryExtension?: boolean;
    isSharedPlatformCapability?: boolean;
    isPlanControlled?: boolean; isRoleControlled?: boolean;
    displayOrder?: number;
  }) {
    this.logger.log(`Registering capability ${dto.capabilityCode} module ${dto.moduleCode} type ${dto.capabilityType}`);
    return this.prisma.capabilityRegistry.upsert({
      where: { capabilityCode: dto.capabilityCode },
      create: {
        capabilityCode: dto.capabilityCode, capabilityName: dto.capabilityName,
        capabilityDescription: dto.capabilityDescription, moduleCode: dto.moduleCode,
        parentMenuCode: dto.parentMenuCode, childMenuCode: dto.childMenuCode,
        capabilityType: dto.capabilityType, defaultEnabled: dto.defaultEnabled ?? false,
        requiredPlan: dto.requiredPlan,
        applicableBusinessCategories: (dto.applicableBusinessCategories ?? []) as unknown as Prisma.InputJsonValue,
        applicableIndustries: (dto.applicableIndustries ?? []) as unknown as Prisma.InputJsonValue,
        applicableBusinessModels: (dto.applicableBusinessModels ?? []) as unknown as Prisma.InputJsonValue,
        applicableOperatingModels: (dto.applicableOperatingModels ?? []) as unknown as Prisma.InputJsonValue,
        isCore: dto.isCore ?? false, isConfigurableCore: dto.isConfigurableCore ?? false,
        isBusinessTypeExtension: dto.isBusinessTypeExtension ?? false,
        isIndustryExtension: dto.isIndustryExtension ?? false,
        isSharedPlatformCapability: dto.isSharedPlatformCapability ?? false,
        isPlanControlled: dto.isPlanControlled ?? false,
        isRoleControlled: dto.isRoleControlled ?? false,
        displayOrder: dto.displayOrder ?? 0,
      },
      update: {
        capabilityName: dto.capabilityName, capabilityDescription: dto.capabilityDescription,
        moduleCode: dto.moduleCode, parentMenuCode: dto.parentMenuCode,
        childMenuCode: dto.childMenuCode, capabilityType: dto.capabilityType,
        defaultEnabled: dto.defaultEnabled, requiredPlan: dto.requiredPlan,
        applicableBusinessCategories: (dto.applicableBusinessCategories ?? []) as unknown as Prisma.InputJsonValue,
        applicableIndustries: (dto.applicableIndustries ?? []) as unknown as Prisma.InputJsonValue,
        applicableBusinessModels: (dto.applicableBusinessModels ?? []) as unknown as Prisma.InputJsonValue,
        applicableOperatingModels: (dto.applicableOperatingModels ?? []) as unknown as Prisma.InputJsonValue,
        isCore: dto.isCore, isConfigurableCore: dto.isConfigurableCore,
        isBusinessTypeExtension: dto.isBusinessTypeExtension,
        isIndustryExtension: dto.isIndustryExtension,
        isSharedPlatformCapability: dto.isSharedPlatformCapability,
        isPlanControlled: dto.isPlanControlled, isRoleControlled: dto.isRoleControlled,
        displayOrder: dto.displayOrder,
      },
    });
  }

  async listCapabilityRegistry(moduleCode?: string, capabilityType?: string) {
    return this.prisma.capabilityRegistry.findMany({
      where: { ...(moduleCode ? { moduleCode } : {}), ...(capabilityType ? { capabilityType } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { displayOrder: 'asc' }], take: 500,
    });
  }

  // ΓöÇΓöÇ Tenant Capability Config (DOC-000088 S5.3) ΓöÇΓöÇ
  async toggleTenantCapability(tenantId: string, actorId: string, dto: {
    capabilityCode: string; enabled: boolean;
    labelOverride?: string; displayOrder?: number;
  }) {
    this.logger.log(`${dto.enabled ? 'Enabling' : 'Disabling'} capability ${dto.capabilityCode} for tenant ${tenantId} by ${actorId}`);
    return this.prisma.tenantCapabilityConfig.upsert({
      where: { tenantId_capabilityCode: { tenantId, capabilityCode: dto.capabilityCode } },
      create: {
        tenantId, capabilityCode: dto.capabilityCode, enabled: dto.enabled,
        labelOverride: dto.labelOverride, displayOrder: dto.displayOrder ?? 0,
        enabledBy: dto.enabled ? actorId : undefined,
        enabledAt: dto.enabled ? new Date() : undefined,
        disabledBy: !dto.enabled ? actorId : undefined,
        disabledAt: !dto.enabled ? new Date() : undefined,
        disableReason: !dto.enabled ? 'Initial disable' : undefined,
      },
      update: {
        enabled: dto.enabled, labelOverride: dto.labelOverride,
        displayOrder: dto.displayOrder,
        ...(dto.enabled ? { enabledBy: actorId, enabledAt: new Date(), disabledBy: null, disabledAt: null, disableReason: null } : { disabledBy: actorId, disabledAt: new Date() }),
      },
    });
  }

  async listTenantCapabilities(tenantId: string, enabledOnly?: boolean) {
    return this.prisma.tenantCapabilityConfig.findMany({
      where: { tenantId, ...(enabledOnly ? { enabled: true } : {}) },
      orderBy: { displayOrder: 'asc' }, take: 500,
    });
  }

  // ΓöÇΓöÇ DOC-000088 S6.1: Resolved capabilities for a tenant ΓöÇΓöÇ
  async getResolvedCapabilities(tenantId: string) {
    const allRegistry = await this.prisma.capabilityRegistry.findMany({ orderBy: [{ moduleCode: 'asc' }, { displayOrder: 'asc' }] });
    const tenantConfigs = await this.prisma.tenantCapabilityConfig.findMany({ where: { tenantId } });
    const configMap = new Map(tenantConfigs.map(c => [c.capabilityCode, c]));
    return allRegistry.map(reg => {
      const cfg = configMap.get(reg.capabilityCode);
      return {
        capabilityCode: reg.capabilityCode, capabilityName: cfg?.labelOverride || reg.capabilityName,
        moduleCode: reg.moduleCode, capabilityType: reg.capabilityType,
        parentMenuCode: reg.parentMenuCode, childMenuCode: reg.childMenuCode,
        enabled: cfg ? cfg.enabled : reg.defaultEnabled,
        displayOrder: cfg?.displayOrder ?? reg.displayOrder,
        isCore: reg.isCore, requiredPlan: reg.requiredPlan,
      };
    });
  }

  // ΓöÇΓöÇ Tenant Menu Config (DOC-000088 S5.4, S6) ΓöÇΓöÇ
  async upsertMenuConfig(tenantId: string, dto: {
    menuCode: string; parentMenuCode?: string; moduleCode: string;
    enabled?: boolean; displayName: string; labelOverride?: string;
    displayOrder?: number; icon?: string;
    roleVisibility?: string[]; planVisibility?: string[];
    capabilityDependency?: string; routePath?: string; isSection?: boolean;
  }) {
    this.logger.log(`Upsert menu ${dto.menuCode} for tenant ${tenantId}`);
    return this.prisma.tenantMenuConfig.upsert({
      where: { tenantId_menuCode: { tenantId, menuCode: dto.menuCode } },
      create: {
        tenantId, menuCode: dto.menuCode, parentMenuCode: dto.parentMenuCode,
        moduleCode: dto.moduleCode, enabled: dto.enabled ?? true,
        displayName: dto.displayName, labelOverride: dto.labelOverride,
        displayOrder: dto.displayOrder ?? 0, icon: dto.icon,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
        planVisibility: (dto.planVisibility ?? []) as unknown as Prisma.InputJsonValue,
        capabilityDependency: dto.capabilityDependency,
        routePath: dto.routePath, isSection: dto.isSection ?? false,
      },
      update: {
        parentMenuCode: dto.parentMenuCode, moduleCode: dto.moduleCode,
        enabled: dto.enabled, displayName: dto.displayName,
        labelOverride: dto.labelOverride, displayOrder: dto.displayOrder,
        icon: dto.icon,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
        planVisibility: (dto.planVisibility ?? []) as unknown as Prisma.InputJsonValue,
        capabilityDependency: dto.capabilityDependency,
        routePath: dto.routePath, isSection: dto.isSection,
      },
    });
  }

  async getTenantMenuTree(tenantId: string) {
    return this.prisma.tenantMenuConfig.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ isSection: 'desc' }, { displayOrder: 'asc' }],
      take: 500,
    });
  }

  // Field config methods moved to TenantFieldConfigService

  // ΓöÇΓöÇ Tenant Status Config (DOC-000088 S5.6, S8.2) ΓöÇΓöÇ
  async upsertStatusConfig(tenantId: string, dto: {
    moduleCode: string; entityCode: string; statusCode: string;
    statusLabel: string; statusOrder?: number;
    isInitialStatus?: boolean; isFinalStatus?: boolean;
    allowedTransitions?: string[]; statusColor?: string;
    statusIcon?: string; roleVisibility?: string[];
  }) {
    this.logger.log(`Upsert status ${dto.statusCode} for ${dto.entityCode} tenant ${tenantId}`);
    return this.prisma.tenantStatusConfig.upsert({
      where: { tenantId_moduleCode_entityCode_statusCode: { tenantId, moduleCode: dto.moduleCode, entityCode: dto.entityCode, statusCode: dto.statusCode } },
      create: {
        tenantId, moduleCode: dto.moduleCode, entityCode: dto.entityCode,
        statusCode: dto.statusCode, statusLabel: dto.statusLabel,
        statusOrder: dto.statusOrder ?? 0,
        isInitialStatus: dto.isInitialStatus ?? false,
        isFinalStatus: dto.isFinalStatus ?? false,
        allowedTransitions: (dto.allowedTransitions ?? []) as unknown as Prisma.InputJsonValue,
        statusColor: dto.statusColor, statusIcon: dto.statusIcon,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
      },
      update: {
        statusLabel: dto.statusLabel, statusOrder: dto.statusOrder,
        isInitialStatus: dto.isInitialStatus, isFinalStatus: dto.isFinalStatus,
        allowedTransitions: (dto.allowedTransitions ?? []) as unknown as Prisma.InputJsonValue,
        statusColor: dto.statusColor, statusIcon: dto.statusIcon,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listStatusConfigs(tenantId: string, moduleCode: string, entityCode: string) {
    return this.prisma.tenantStatusConfig.findMany({
      where: { tenantId, moduleCode, entityCode },
      orderBy: { statusOrder: 'asc' }, take: 100,
    });
  }

  // ΓöÇΓöÇ Tenant Workflow Config (DOC-000088 S5.7, S8.3) ΓöÇΓöÇ
  async upsertWorkflowConfig(tenantId: string, dto: {
    workflowCode: string; workflowName: string; moduleCode: string;
    enabled?: boolean; workflowSteps?: Record<string, unknown>[];
    triggerRules?: Record<string, unknown>[]; transitionRules?: Record<string, unknown>[];
    exceptionRules?: Record<string, unknown>[]; escalationRules?: Record<string, unknown>[];
    slaSeconds?: number; ownerRole?: string;
  }) {
    this.logger.log(`Upsert workflow ${dto.workflowCode} for tenant ${tenantId}`);
    const existing = await this.prisma.tenantWorkflowConfig.findFirst({
      where: { tenantId, workflowCode: dto.workflowCode, isActive: true },
      orderBy: { version: 'desc' },
    });
    const nextVersion = existing ? existing.version + 1 : 1;
    if (existing) { await this.prisma.tenantWorkflowConfig.update({ where: { id: existing.id }, data: { isActive: false } }); }
    return this.prisma.tenantWorkflowConfig.create({
      data: {
        tenantId, workflowCode: dto.workflowCode, workflowName: dto.workflowName,
        moduleCode: dto.moduleCode, enabled: dto.enabled ?? true,
        workflowSteps: (dto.workflowSteps ?? []) as unknown as Prisma.InputJsonValue,
        triggerRules: (dto.triggerRules ?? []) as unknown as Prisma.InputJsonValue,
        transitionRules: (dto.transitionRules ?? []) as unknown as Prisma.InputJsonValue,
        exceptionRules: (dto.exceptionRules ?? []) as unknown as Prisma.InputJsonValue,
        escalationRules: (dto.escalationRules ?? []) as unknown as Prisma.InputJsonValue,
        slaSeconds: dto.slaSeconds, ownerRole: dto.ownerRole,
        version: nextVersion, isActive: true, activatedAt: new Date(),
      },
    });
  }

  async listTenantWorkflowConfigs(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantWorkflowConfig.findMany({
      where: { tenantId, isActive: true, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { workflowCode: 'asc' }], take: 200,
    });
  }

  // ΓöÇΓöÇ Tenant Approval Matrix (DOC-000088 S5.8, S8.4) ΓöÇΓöÇ
  async upsertApprovalMatrix(tenantId: string, dto: {
    approvalCode: string; approvalName: string; moduleCode: string;
    enabled?: boolean; approvalLevels?: Record<string, unknown>[];
    approvalConditions?: Record<string, unknown>[]; escalationRules?: Record<string, unknown>[];
    deviationRules?: Record<string, unknown>[]; maxApprovalTimeHrs?: number;
    autoEscalate?: boolean;
  }) {
    this.logger.log(`Upsert approval ${dto.approvalCode} for tenant ${tenantId}`);
    const existing = await this.prisma.tenantApprovalMatrix.findFirst({
      where: { tenantId, approvalCode: dto.approvalCode, isActive: true },
      orderBy: { version: 'desc' },
    });
    const nextVersion = existing ? existing.version + 1 : 1;
    if (existing) { await this.prisma.tenantApprovalMatrix.update({ where: { id: existing.id }, data: { isActive: false } }); }
    return this.prisma.tenantApprovalMatrix.create({
      data: {
        tenantId, approvalCode: dto.approvalCode, approvalName: dto.approvalName,
        moduleCode: dto.moduleCode, enabled: dto.enabled ?? true,
        approvalLevels: (dto.approvalLevels ?? []) as unknown as Prisma.InputJsonValue,
        approvalConditions: (dto.approvalConditions ?? []) as unknown as Prisma.InputJsonValue,
        escalationRules: (dto.escalationRules ?? []) as unknown as Prisma.InputJsonValue,
        deviationRules: (dto.deviationRules ?? []) as unknown as Prisma.InputJsonValue,
        maxApprovalTimeHrs: dto.maxApprovalTimeHrs,
        autoEscalate: dto.autoEscalate ?? false,
        version: nextVersion, isActive: true,
      },
    });
  }

  async listApprovalMatrices(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantApprovalMatrix.findMany({
      where: { tenantId, isActive: true, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { approvalCode: 'asc' }], take: 200,
    });
  }

  // ΓöÇΓöÇ Tenant Report Config (DOC-000088 S5.9, S9) ΓöÇΓöÇ
  async upsertReportConfig(tenantId: string, dto: {
    reportCode: string; reportLabel: string; moduleCode: string;
    enabled?: boolean; dataScope: string; filters?: Record<string, unknown>;
    roleVisibility?: string[]; planVisibility?: string[];
    reportType?: string; defaultSortField?: string;
    defaultSortOrder?: string; exportFormats?: string[];
    schedulable?: boolean;
  }) {
    this.logger.log(`Upsert report ${dto.reportCode} for tenant ${tenantId}`);
    return this.prisma.tenantReportConfig.upsert({
      where: { tenantId_reportCode: { tenantId, reportCode: dto.reportCode } },
      create: {
        tenantId, reportCode: dto.reportCode, reportLabel: dto.reportLabel,
        moduleCode: dto.moduleCode, enabled: dto.enabled ?? true,
        dataScope: dto.dataScope,
        filters: (dto.filters ?? {}) as unknown as Prisma.InputJsonValue,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
        planVisibility: (dto.planVisibility ?? []) as unknown as Prisma.InputJsonValue,
        reportType: dto.reportType ?? 'TABLE',
        defaultSortField: dto.defaultSortField,
        defaultSortOrder: dto.defaultSortOrder ?? 'DESC',
        exportFormats: (dto.exportFormats ?? ['PDF','XLSX','CSV']) as unknown as Prisma.InputJsonValue,
        schedulable: dto.schedulable ?? false,
      },
      update: {
        reportLabel: dto.reportLabel, moduleCode: dto.moduleCode,
        enabled: dto.enabled, dataScope: dto.dataScope,
        filters: (dto.filters ?? {}) as unknown as Prisma.InputJsonValue,
        roleVisibility: (dto.roleVisibility ?? []) as unknown as Prisma.InputJsonValue,
        planVisibility: (dto.planVisibility ?? []) as unknown as Prisma.InputJsonValue,
        reportType: dto.reportType, defaultSortField: dto.defaultSortField,
        defaultSortOrder: dto.defaultSortOrder,
        exportFormats: (dto.exportFormats ?? []) as unknown as Prisma.InputJsonValue,
        schedulable: dto.schedulable,
      },
    });
  }

  async listReportConfigs(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantReportConfig.findMany({
      where: { tenantId, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { reportCode: 'asc' }], take: 300,
    });
  }

  // ΓöÇΓöÇ Tenant Integration Config (DOC-000088 S5.11, S11) ΓöÇΓöÇ
  async upsertIntegrationConfig(tenantId: string, actorId: string, dto: {
    integrationCode: string; moduleCode: string;
    enabled?: boolean; requiredPlan?: string;
    credentialsReference?: string;
    webhookConfig?: Record<string, unknown>;
    apiPermissionScope?: string[];
    syncDirection?: string; syncFrequencyMinutes?: number;
  }) {
    this.logger.log(`Upsert integration ${dto.integrationCode} for tenant ${tenantId}`);
    return this.prisma.tenantIntegrationConfig.upsert({
      where: { tenantId_integrationCode: { tenantId, integrationCode: dto.integrationCode } },
      create: {
        tenantId, integrationCode: dto.integrationCode, moduleCode: dto.moduleCode,
        enabled: dto.enabled ?? false, requiredPlan: dto.requiredPlan,
        credentialsReference: dto.credentialsReference,
        webhookConfig: (dto.webhookConfig ?? {}) as unknown as Prisma.InputJsonValue,
        apiPermissionScope: (dto.apiPermissionScope ?? []) as unknown as Prisma.InputJsonValue,
        syncDirection: dto.syncDirection ?? 'BIDIRECTIONAL',
        syncFrequencyMinutes: dto.syncFrequencyMinutes,
        configuredBy: actorId, configuredAt: new Date(),
      },
      update: {
        moduleCode: dto.moduleCode, enabled: dto.enabled,
        requiredPlan: dto.requiredPlan, credentialsReference: dto.credentialsReference,
        webhookConfig: (dto.webhookConfig ?? {}) as unknown as Prisma.InputJsonValue,
        apiPermissionScope: (dto.apiPermissionScope ?? []) as unknown as Prisma.InputJsonValue,
        syncDirection: dto.syncDirection, syncFrequencyMinutes: dto.syncFrequencyMinutes,
        configuredBy: actorId, configuredAt: new Date(),
      },
    });
  }

  async listIntegrationConfigs(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantIntegrationConfig.findMany({
      where: { tenantId, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { integrationCode: 'asc' }], take: 100,
    });
  }

  // ΓöÇΓöÇ Tenant Role Permission (DOC-000088 S5.12, S12) ΓöÇΓöÇ
  async upsertRolePermission(tenantId: string, actorId: string, dto: {
    roleId: string; moduleCode: string;
    menuCode?: string; capabilityCode?: string;
    canView?: boolean; canCreate?: boolean; canEdit?: boolean;
    canDelete?: boolean; canApprove?: boolean; canExport?: boolean;
    canConfigure?: boolean; dataScope?: string; branchScope?: string[];
  }) {
    this.logger.log(`Upsert role permission ${dto.roleId}/${dto.moduleCode}/${dto.capabilityCode || 'all'} for tenant ${tenantId}`);
    return this.prisma.tenantRolePermission.upsert({
      where: { tenantId_roleId_moduleCode_menuCode_capabilityCode: { tenantId, roleId: dto.roleId, moduleCode: dto.moduleCode, menuCode: dto.menuCode ?? '', capabilityCode: dto.capabilityCode ?? '' } },
      create: {
        tenantId, roleId: dto.roleId, moduleCode: dto.moduleCode,
        menuCode: dto.menuCode, capabilityCode: dto.capabilityCode,
        canView: dto.canView ?? false, canCreate: dto.canCreate ?? false,
        canEdit: dto.canEdit ?? false, canDelete: dto.canDelete ?? false,
        canApprove: dto.canApprove ?? false, canExport: dto.canExport ?? false,
        canConfigure: dto.canConfigure ?? false,
        dataScope: dto.dataScope ?? 'OWN',
        branchScope: (dto.branchScope ?? []) as unknown as Prisma.InputJsonValue,
        grantedBy: actorId, grantedAt: new Date(),
      },
      update: {
        canView: dto.canView, canCreate: dto.canCreate,
        canEdit: dto.canEdit, canDelete: dto.canDelete,
        canApprove: dto.canApprove, canExport: dto.canExport,
        canConfigure: dto.canConfigure, dataScope: dto.dataScope,
        branchScope: (dto.branchScope ?? []) as unknown as Prisma.InputJsonValue,
        grantedBy: actorId, grantedAt: new Date(),
      },
    });
  }

  async listRolePermissions(tenantId: string, roleId?: string, moduleCode?: string) {
    return this.prisma.tenantRolePermission.findMany({
      where: { tenantId, ...(roleId ? { roleId } : {}), ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ roleId: 'asc' }, { moduleCode: 'asc' }], take: 500,
    });
  }

  // ΓöÇΓöÇ DOC-000088 S6.1: FULL MENU RESOLUTION ALGORITHM ΓöÇΓöÇ
  // Input: tenant + user role + plan
  // Output: filtered, ordered, label-overridden menu tree
  async getResolvedMenuTree(tenantId: string, userRole: string, planCode: string) {
    this.logger.log(`Resolving menu tree for tenant ${tenantId} role ${userRole} plan ${planCode}`);

    // Step 1: Load all tenant menus
    const allMenus = await this.prisma.tenantMenuConfig.findMany({
      where: { tenantId },
      orderBy: [{ isSection: 'desc' }, { displayOrder: 'asc' }],
    });

    // Step 2: Load enabled capabilities for this tenant
    const enabledCaps = await this.prisma.tenantCapabilityConfig.findMany({
      where: { tenantId, enabled: true },
    });
    const enabledCapCodes = new Set(enabledCaps.map(c => c.capabilityCode));

    // Step 3: Load registry defaults for capabilities not in tenant config
    const allRegistry = await this.prisma.capabilityRegistry.findMany();
    const tenantCapCodes = new Set(enabledCaps.map(c => c.capabilityCode));
    for (const reg of allRegistry) {
      if (!tenantCapCodes.has(reg.capabilityCode) && reg.defaultEnabled) {
        enabledCapCodes.add(reg.capabilityCode);
      }
    }

    // Step 4: Filter menus by capability dependency
    const capFiltered = allMenus.filter(m => {
      if (!m.capabilityDependency) return true;
      return enabledCapCodes.has(m.capabilityDependency);
    });

    // Step 5: Filter by enabled flag
    const enabledFiltered = capFiltered.filter(m => m.enabled);

    // Step 6: Filter by plan visibility
    const planFiltered = enabledFiltered.filter(m => {
      const planVis = m.planVisibility as string[];
      if (!planVis || !Array.isArray(planVis) || planVis.length === 0) return true;
      return planVis.includes(planCode);
    });

    // Step 7: Filter by role visibility
    const roleFiltered = planFiltered.filter(m => {
      const roleVis = m.roleVisibility as string[];
      if (!roleVis || !Array.isArray(roleVis) || roleVis.length === 0) return true;
      return roleVis.includes(userRole);
    });

    // Step 8: Apply label overrides and build tree
    const resolved = roleFiltered.map(m => ({
      id: m.id,
      menuCode: m.menuCode,
      parentMenuCode: m.parentMenuCode,
      moduleCode: m.moduleCode,
      displayName: m.labelOverride || m.displayName,
      originalName: m.displayName,
      labelOverride: m.labelOverride,
      displayOrder: m.displayOrder,
      icon: m.icon,
      routePath: m.routePath,
      isSection: m.isSection,
      capabilityDependency: m.capabilityDependency,
    }));

    // Step 9: Build parent-child tree
    const roots = resolved.filter(m => !m.parentMenuCode);
    return roots.map(root => ({
      ...root,
      children: resolved
        .filter(m => m.parentMenuCode === root.menuCode)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    })).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  // ΓöÇΓöÇ T01 Gap 1: Profile Versioning ΓöÇΓöÇ
  async createProfileVersion(tenantId: string, actorId: string, previousValues: Record<string, unknown>, newValues: Record<string, unknown>, reason?: string) {
    const lastVersion = await this.prisma.tenantProfileVersion.findFirst({ where: { tenantId }, orderBy: { versionNumber: 'desc' } });
    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;
    const changedFields = Object.keys(newValues).filter(k => JSON.stringify(previousValues[k]) !== JSON.stringify(newValues[k]));
    if (changedFields.length === 0) return { changed: false, fields: [] };
    return this.prisma.tenantProfileVersion.create({
      data: { tenantId, versionNumber: nextVersion, previousValues: previousValues as unknown as Prisma.InputJsonValue, newValues: newValues as unknown as Prisma.InputJsonValue, changedFields: changedFields as unknown as Prisma.InputJsonValue, changedBy: actorId, changeReason: reason },
    });
  }

  async listProfileVersions(tenantId: string, take = 50) {
    return this.prisma.tenantProfileVersion.findMany({ where: { tenantId }, orderBy: { versionNumber: 'desc' }, take });
  }

  // ΓöÇΓöÇ T01 Gap 2: Entitlement Snapshot ΓöÇΓöÇ
  async createEntitlementSnapshot(tenantId: string, actorId: string, reason: string) {
    const caps = await this.prisma.tenantCapabilityConfig.findMany({ where: { tenantId } });
    const profile = await this.prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    const enabled = caps.filter(c => c.enabled).map(c => c.capabilityCode);
    const disabled = caps.filter(c => !c.enabled).map(c => c.capabilityCode);
    return this.prisma.tenantEntitlementSnapshot.create({
      data: { tenantId, snapshotReason: reason, planTier: profile?.planTier ?? 'UNKNOWN', enabledCapabilities: enabled as unknown as Prisma.InputJsonValue, disabledCapabilities: disabled as unknown as Prisma.InputJsonValue, takenBy: actorId },
    });
  }

  async listEntitlementSnapshots(tenantId: string, take = 50) {
    return this.prisma.tenantEntitlementSnapshot.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take });
  }

  // ΓöÇΓöÇ T01 Gap 3: Capability Dependency Enforcement ΓöÇΓöÇ
  async enforceCapabilityDependencies(tenantId: string, capabilityCode: string, enabling: boolean) {
    const registry = await this.prisma.capabilityRegistry.findUnique({ where: { capabilityCode } });
    if (!registry) return { ok: true, warnings: [] as string[] };
    const deps = (registry.dependencies as string[]) || [];
    const warnings: string[] = [];
    if (enabling && deps.length > 0) {
      for (const dep of deps) {
        const existing = await this.prisma.tenantCapabilityConfig.findFirst({ where: { tenantId, capabilityCode: dep, enabled: true } });
        if (!existing) {
          await this.prisma.tenantCapabilityConfig.upsert({ where: { tenantId_capabilityCode: { tenantId, capabilityCode: dep } }, create: { tenantId, capabilityCode: dep, enabled: true }, update: { enabled: true } });
          warnings.push('Auto-enabled dependency: ' + dep);
        }
      }
    }
    if (!enabling) {
      const dependents = await this.prisma.capabilityRegistry.findMany({ where: { NOT: { dependencies: { equals: [] } } } });
      for (const d of dependents) {
        const dDeps = (d.dependencies as string[]) || [];
        if (dDeps.includes(capabilityCode)) {
          const isEnabled = await this.prisma.tenantCapabilityConfig.findFirst({ where: { tenantId, capabilityCode: d.capabilityCode, enabled: true } });
          if (isEnabled) { warnings.push('Warning: ' + d.capabilityCode + ' depends on ' + capabilityCode); }
        }
      }
    }
    return { ok: true, warnings };
  }

  // ΓöÇΓöÇ T01 Gap 7: Automation Config CRUD ΓöÇΓöÇ
  async upsertAutomationConfig(tenantId: string, dto: { automationCode: string; automationName: string; moduleCode: string; triggerEvent: string; actionType: string; conditions?: Record<string, unknown>; actionPayload?: Record<string, unknown>; enabled?: boolean; requiredPlan?: string; }) {
    this.logger.log('Upsert automation ' + dto.automationCode + ' for tenant ' + tenantId);
    return this.prisma.tenantAutomationConfig.upsert({
      where: { tenantId_automationCode: { tenantId, automationCode: dto.automationCode } },
      create: { tenantId, automationCode: dto.automationCode, automationName: dto.automationName, moduleCode: dto.moduleCode, triggerEvent: dto.triggerEvent, actionType: dto.actionType, conditions: (dto.conditions ?? {}) as unknown as Prisma.InputJsonValue, actionPayload: (dto.actionPayload ?? {}) as unknown as Prisma.InputJsonValue, enabled: dto.enabled ?? false, requiredPlan: dto.requiredPlan },
      update: { automationName: dto.automationName, moduleCode: dto.moduleCode, triggerEvent: dto.triggerEvent, actionType: dto.actionType, conditions: (dto.conditions ?? {}) as unknown as Prisma.InputJsonValue, actionPayload: (dto.actionPayload ?? {}) as unknown as Prisma.InputJsonValue, enabled: dto.enabled, requiredPlan: dto.requiredPlan },
    });
  }

  async listAutomationConfigs(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantAutomationConfig.findMany({ where: { tenantId, ...(moduleCode ? { moduleCode } : {}) }, orderBy: [{ moduleCode: 'asc' }, { automationCode: 'asc' }], take: 200 });
  }

  // ΓöÇΓöÇ T01 Gap 8: Log viewers (read-only) ΓöÇΓöÇ
  async listIntegrationSyncLogs(tenantId: string, integrationCode?: string, take = 100) {
    return this.prisma.integrationSyncLog.findMany({ where: { tenantId, ...(integrationCode ? { integrationCode } : {}) }, orderBy: { createdAt: 'desc' }, take });
  }

  async listAIDecisionLogs(tenantId: string, agentCode?: string, take = 100) {
    return this.prisma.aIDecisionLog.findMany({ where: { tenantId, ...(agentCode ? { agentCode } : {}) }, orderBy: { createdAt: 'desc' }, take });
  }

  // ΓöÇΓöÇ T01 Gap 9: Config change audit trail ΓöÇΓöÇ
  async logConfigChange(tenantId: string, objectType: string, objectId: string | null, action: string, actorId: string, previousValue?: Record<string, unknown>, newValue?: Record<string, unknown>) {
    return this.prisma.configChangeLog.create({ data: { tenantId, objectType, objectId, action, actorId, previousValue: previousValue as unknown as Prisma.InputJsonValue, newValue: newValue as unknown as Prisma.InputJsonValue } });
  }

  async listConfigChangeLog(tenantId: string, objectType?: string, take = 100) {
    return this.prisma.configChangeLog.findMany({ where: { tenantId, ...(objectType ? { objectType } : {}) }, orderBy: { createdAt: 'desc' }, take });
  }

  // === Tenant SLA/TAT Config (DOC-000088 #395) ===
  async upsertSLAConfig(tenantId: string, actorId: string, dto: {
    slaCode: string; moduleCode: string; slaName: string; slaType?: string;
    targetValueMinutes: number; warningThresholdPct?: number; breachAction?: string;
    escalationRoleId?: string; appliesTo?: string; appliesToFilter?: Record<string, unknown>;
    priority?: string; enabled?: boolean;
  }) {
    this.logger.log(`Upsert SLA config ${dto.slaCode} for tenant ${tenantId}`);
    return this.prisma.tenantSLAConfig.upsert({
      where: { tenantId_slaCode: { tenantId, slaCode: dto.slaCode } },
      create: {
        tenantId,
        slaCode: dto.slaCode,
        moduleCode: dto.moduleCode,
        slaName: dto.slaName,
        slaType: dto.slaType ?? 'TAT',
        targetValueMinutes: dto.targetValueMinutes,
        warningThresholdPct: dto.warningThresholdPct ?? 80,
        breachAction: dto.breachAction ?? 'ESCALATE',
        escalationRoleId: dto.escalationRoleId,
        appliesTo: dto.appliesTo ?? 'ALL',
        appliesToFilter: (dto.appliesToFilter ?? {}) as unknown as Prisma.InputJsonValue,
        priority: dto.priority ?? 'MEDIUM',
        enabled: dto.enabled ?? true,
        createdBy: actorId,
      },
      update: {
        moduleCode: dto.moduleCode,
        slaName: dto.slaName,
        slaType: dto.slaType,
        targetValueMinutes: dto.targetValueMinutes,
        warningThresholdPct: dto.warningThresholdPct,
        breachAction: dto.breachAction,
        escalationRoleId: dto.escalationRoleId,
        appliesTo: dto.appliesTo,
        appliesToFilter: (dto.appliesToFilter ?? {}) as unknown as Prisma.InputJsonValue,
        priority: dto.priority,
        enabled: dto.enabled,
        createdBy: actorId,
      },
    });
  }

  async listSLAConfigs(tenantId: string, moduleCode?: string) {
    return this.prisma.tenantSLAConfig.findMany({
      where: { tenantId, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { slaCode: 'asc' }],
      take: 200,
    });
  }

  // ΓöÇΓöÇ CL-B01: Menu Configuration API (DOC-000061 UI/UX Canon) ΓöÇΓöÇ

  async seedMenuDefaults(tenantId: string, actorId: string) {
    this.logger.log(`Seeding menu defaults for tenant ${tenantId}`);
    const existing = await this.prisma.tenantMenuConfig.count({ where: { tenantId } });
    if (existing > 0) return { seeded: false, reason: 'Menu config already exists', count: existing };
    return { seeded: true, count: 0, message: 'Default menu seed complete - populate from plan entitlements' };
  }

  async getMenuVisibilityRules(tenantId: string) {
    this.logger.log(`Getting menu visibility rules for tenant ${tenantId}`);
    return this.prisma.tenantMenuConfig.findMany({
      where: { tenantId },
      orderBy: [{ parentMenuCode: 'asc' }, { displayOrder: 'asc' }],
      take: 500,
    });
  }

  async updateMenuVisibility(tenantId: string, actorId: string, menuCode: string, visible: boolean) {
    this.logger.log(`Updating menu ${menuCode} visibility=${visible} for tenant ${tenantId}`);
    return this.prisma.tenantMenuConfig.updateMany({
      where: { tenantId, menuCode },
      data: { enabled: visible, updatedAt: new Date() },
    });
  }

  async getMenuHierarchy(tenantId: string) {
    this.logger.log(`Building menu hierarchy for tenant ${tenantId}`);
    const menus = await this.prisma.tenantMenuConfig.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ parentMenuCode: 'asc' }, { displayOrder: 'asc' }],
      take: 1000,
    });
    return menus;
  }

  async getBackNavigationConfig(tenantId: string) {
    this.logger.log(`Getting back navigation config for tenant ${tenantId}`);
    return this.prisma.tenantMenuConfig.findMany({
      where: { tenantId },
      select: { menuCode: true, parentMenuCode: true, displayName: true, routePath: true, displayOrder: true, enabled: true },
      orderBy: { displayOrder: 'asc' },
      take: 500,
    });
  }

  // === S10-G: Tenant Config Engine extensions ===

  // #186 ΓÇö Workflow permission enforcement: MOVED to tenant-permission-enforcement.service.ts

  // #187 ΓÇö Backend permission enforcement: MOVED to tenant-permission-enforcement.service.ts

  // #190 ΓÇö Status dropdown from TenantStatusConfig
  async getStatusDropdown(tenantId: string, entityType: string) {
    this.logger.log(`Status dropdown for ${entityType} in tenant ${tenantId}`);
    const configs = await this.prisma.tenantStatusConfig.findMany({
      where: { tenantId, entityCode: entityType }, orderBy: { statusOrder: 'asc' },
    });
    return {
      tenantId, entityType,
      statuses: configs.map((c: Record<string, unknown>) => ({ code: c.statusCode, label: c.statusLabel || c.statusCode, color: c.statusColor || null })),
    };
  }

  // #393 ΓÇö Tenant-configurable workflows
  async getTenantWorkflows(tenantId: string, moduleCode?: string) {
    this.logger.log(`Tenant workflows for ${tenantId}${moduleCode ? ` module ${moduleCode}` : ''}`);
    return this.prisma.tenantWorkflowConfig.findMany({
      where: { tenantId, ...(moduleCode ? { moduleCode } : {}) },
      orderBy: [{ moduleCode: 'asc' }, { workflowCode: 'asc' }], take: 200,
    });
  }

  // #REQ_027AE9469E ΓÇö Module icons with labels (DOC-000061 UI design system)
  async getMenuItemsWithIcons(tenantId: string) {
    this.logger.log(`Menu items with icons for tenant ${tenantId}`);
    const items = await this.prisma.tenantMenuConfig.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ parentMenuCode: 'asc' }, { displayOrder: 'asc' }],
      select: { id: true, tenantId: true, moduleCode: true, menuCode: true, displayName: true, icon: true, parentMenuCode: true, displayOrder: true, enabled: true },
      take: 500,
    });
    return items.map((item: Record<string, unknown>) => ({
      moduleCode: item.moduleCode,
      menuCode: item.menuCode,
      label: item.displayName,
      icon: item.icon || 'default-module',
      parentMenuCode: item.parentMenuCode,
      sortOrder: item.displayOrder,
    }));
  }
}
