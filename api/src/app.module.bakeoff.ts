import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { KernelModule } from './kernel/kernel.module';
import { TenantConfigEngineModule } from './modules/tenant-config-engine/tenant-config-engine.module';
import { V0ReadinessModule } from './modules/v0-readiness/v0-readiness.module';
import { BakeoffDimensioningModule } from './modules/bakeoff-dimensioning/bakeoff-dimensioning.module';
import { CapabilityGuard } from './modules/tenant-config-engine/capability.guard';

/** SYNTHETIC_BAKEOFF — slim module root for qualification repository only. */
@Module({
  imports: [
    PrismaModule,
    KernelModule,
    AuthModule,
    TenantConfigEngineModule,
    V0ReadinessModule,
    BakeoffDimensioningModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CapabilityGuard }],
})
export class AppModuleBakeoff {}
