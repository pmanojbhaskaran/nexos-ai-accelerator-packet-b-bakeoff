import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantConfigEngineService } from './tenant-config-engine.service';
import { TenantConfigEngineController } from './tenant-config-engine.controller';
import { TenantConfigSeedService } from './tenant-config-seed.service';
import { TenantConfigSeedController } from './tenant-config-seed.controller';
import { CapabilityGuard } from './capability.guard';
import { TenantPermissionEnforcementService } from './tenant-permission-enforcement.service';
import { TenantFieldConfigController } from './tenant-field-config.controller';
import { TenantFieldConfigService } from './tenant-field-config.service';

@Global()
@Module({
  controllers: [TenantConfigEngineController, TenantConfigSeedController, TenantFieldConfigController],
  providers: [PrismaService, TenantConfigEngineService, TenantConfigSeedService, CapabilityGuard, TenantPermissionEnforcementService, TenantFieldConfigService],
  exports: [TenantConfigEngineService, TenantConfigSeedService, CapabilityGuard, TenantPermissionEnforcementService, TenantFieldConfigService],
})
export class TenantConfigEngineModule {}
