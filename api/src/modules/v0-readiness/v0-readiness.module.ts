import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { CoLoaderResponsibilityModule } from '../coloader-responsibility/coloader-responsibility.module';
import { FinanceModule } from '../finance/finance.module';
import { CoreLogisticsOpsModule } from '../core-logistics-ops/core-logistics-ops.module';
import { PayablesDisciplineModule } from '../treasury/payables-discipline/payables-discipline.module';
import { HrmsOpsModule } from '../hrms-ops/hrms-ops.module';
import { MovementMasterModule } from '../movement-master/movement-master.module';
import { DeliveryPodClosureModule } from '../delivery-pod-closure/delivery-pod-closure.module';
import { LaterReleaseGuard } from './later-release.guard';
import { V0OrganizationAliasController, V0ReadinessController } from './v0-readiness.controller';
import { V0ReadinessService } from './v0-readiness.service';
import { V1DomesticLaunchModule } from '../v1-domestic-launch/v1-domestic-launch.module';

@Module({
  imports: [
    PrismaModule,
    V1DomesticLaunchModule,
    ShipmentsModule,
    CoLoaderResponsibilityModule,
    FinanceModule,
    CoreLogisticsOpsModule,
    PayablesDisciplineModule,
    HrmsOpsModule,
    MovementMasterModule,
    DeliveryPodClosureModule,
  ],
  controllers: [V0ReadinessController, V0OrganizationAliasController],
  providers: [V0ReadinessService, LaterReleaseGuard],
  exports: [V0ReadinessService, LaterReleaseGuard],
})
export class V0ReadinessModule {}
