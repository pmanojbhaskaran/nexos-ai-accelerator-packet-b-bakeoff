// kernel.module.ts -- Aggregates all kernel infrastructure components
// Sub-batch 1A: audit, evidence, conflict resolution, AI boundary, kill switch
// Sub-batch 1B: standard work, abnormality, error-proofing, forced-negative
// Sub-batch 1C: reversibility, LEK arbitration, six-layer AI, AIBD, CEO acknowledgement
// Block K1: 4 controllers wiring all services to API endpoints
import { OperationalSurfaceEnforcementService } from './operational-surface-enforcement.service';
import { CapabilityPlanBoundaryEnforcementService } from './capability-plan-boundary-enforcement.service';
import { GovernanceInvariantEnforcementService } from './governance-invariant-enforcement.service';
import { UIDesignSystemEnforcementService } from './ui-design-system-enforcement.service';
import { DynamicMenuEnforcementService } from './dynamic-menu-enforcement.service';
import { ModuleAccessGuard } from './module-access.guard';
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { KernelValidationInterceptor } from './kernel-validation.interceptor';
import { CommandBusService } from './command-bus.service';
import { FsmEngineService } from './fsm-engine.service';
import { RbacGuard } from './rbac.guard';
import { GrowthStateGuard } from './growth-state.guard';
import { KernelAuditService } from './audit.service';
import { KernelEvidenceService } from './evidence.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { AIAuthorityEnforcementService } from './ai-authority-enforcement.service';
import { TenantIsolationEnforcementService } from './tenant-isolation-enforcement.service';
import { PECIEnvelopeGSEnforcementService } from './peci-envelope-gs-enforcement.service';
import { EventAuditELoREnforcementService } from './event-audit-elor-enforcement.service';
import { SecurityAuthEnforcementService } from './security-auth-enforcement.service';
import { DataModelIntegrityEnforcementService } from './data-model-integrity-enforcement.service';
import { AIBoundaryGuard } from './ai-boundary.guard';
import { AIKillSwitchService } from './ai-kill-switch.service';
import { StandardWorkService } from './standard-work.service';
import { AbnormalityService } from './abnormality.service';
import { ErrorProofingService } from './error-proofing.service';
import { ForcedNegativeService } from './forced-negative.service';
import { ReversibilityService } from './reversibility.service';
import { LEKArbitrationService } from './lek-arbitration.service';
import { SixLayerAIService } from './six-layer-ai.service';
import { AIBDRegistryService } from './aibd-registry.service';
import { CEOAcknowledgementService } from './ceo-acknowledgement.service';
import { NestPolicyRegistryService } from './policy/NestPolicyRegistryService';
import { KernelController } from './kernel.controller';
import { KernelEnforcementController } from './kernel-enforcement.controller';
import { KernelGovernanceController } from './kernel-governance.controller';
import { KernelAIController } from './kernel-ai.controller';

import { AuthPrincipalGuard } from '../common/guards/auth-principal.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CanonicalEnvelopeInterceptor } from '../common/interceptors/canonical-envelope.interceptor';
import { GSAutonomyCeilingService } from './growthState/gs-autonomy-ceiling.service';
import { AIConfidenceService } from './ai-confidence.service';
import { FMEAReleaseGateService } from './fmea-release-gate.service';
import { KASEBStopGateService } from './kaseb-stop-gate.service';
import { ModelVersionRegistryService } from './model-version-registry.service';
@Global()
@Module({
  controllers: [
    KernelController,
    KernelEnforcementController,
    KernelGovernanceController,
    KernelAIController,
  ],
  providers: [
    OperationalSurfaceEnforcementService,
    CapabilityPlanBoundaryEnforcementService,
    GovernanceInvariantEnforcementService,
    UIDesignSystemEnforcementService,
    DynamicMenuEnforcementService,
    ModuleAccessGuard,
    { provide: APP_INTERCEPTOR, useClass: KernelValidationInterceptor },
    { provide: APP_GUARD, useClass: AuthPrincipalGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    AIAuthorityEnforcementService,
    TenantIsolationEnforcementService,
    PECIEnvelopeGSEnforcementService,
    EventAuditELoREnforcementService,
    SecurityAuthEnforcementService,
    DataModelIntegrityEnforcementService,
    { provide: APP_GUARD, useClass: AIBoundaryGuard },
    { provide: APP_INTERCEPTOR, useClass: CanonicalEnvelopeInterceptor },
    CommandBusService,
    FsmEngineService,
    RbacGuard,
    GrowthStateGuard,
    KernelAuditService,
    KernelEvidenceService,
    ConflictResolutionService,
    AIKillSwitchService,
    StandardWorkService,
    AbnormalityService,
    ErrorProofingService,
    ForcedNegativeService,
    ReversibilityService,
    LEKArbitrationService,
    SixLayerAIService,
    AIBDRegistryService,
    CEOAcknowledgementService,
    NestPolicyRegistryService,
    AIConfidenceService,
    FMEAReleaseGateService,
    KASEBStopGateService,
    ModelVersionRegistryService,
    GSAutonomyCeilingService,
    TenantIsolationEnforcementService,
    PECIEnvelopeGSEnforcementService,
    EventAuditELoREnforcementService,
    SecurityAuthEnforcementService,
    DataModelIntegrityEnforcementService,
  ],
  exports: [
    OperationalSurfaceEnforcementService,
    CapabilityPlanBoundaryEnforcementService,
    GovernanceInvariantEnforcementService,
    UIDesignSystemEnforcementService,
    DynamicMenuEnforcementService,
    ModuleAccessGuard,
    CommandBusService,
    FsmEngineService,
    RbacGuard,
    GrowthStateGuard,
    KernelAuditService,
    KernelEvidenceService,
    ConflictResolutionService,
    AIKillSwitchService,
    StandardWorkService,
    AbnormalityService,
    ErrorProofingService,
    ForcedNegativeService,
    ReversibilityService,
    LEKArbitrationService,
    SixLayerAIService,
    AIBDRegistryService,
    CEOAcknowledgementService,
    NestPolicyRegistryService,
    AIConfidenceService,
    FMEAReleaseGateService,
    KASEBStopGateService,
    ModelVersionRegistryService,
    GSAutonomyCeilingService,
    TenantIsolationEnforcementService,
    PECIEnvelopeGSEnforcementService,
    EventAuditELoREnforcementService,
    SecurityAuthEnforcementService,
    DataModelIntegrityEnforcementService,
  ],
})
export class KernelModule {
  constructor(private readonly fsm: FsmEngineService) {
    this.fsm.bootstrapCanonicalFsms();
  }
}
