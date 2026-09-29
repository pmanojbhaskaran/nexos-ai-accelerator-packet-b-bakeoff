// tenant-provisioning.controller.ts ΓÇö Public sign-up + provisioning status
import { Controller, Post, Get, Body, Param, Query , Logger } from '@nestjs/common';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { Public } from './jwt-auth.guard';

@Controller('tenant')
export class TenantProvisioningController {
  private readonly logger = new Logger(TenantProvisioningController.name);
  constructor(private readonly svc: TenantProvisioningService) {}

  @Public()
  @Post('sign-up')
  signUp(@Body() dto: any) { return this.svc.provisionTenant(dto); }

  @Get('provisioning/:code')
  getStatus(@Param('code') code: string) { return this.svc.getProvisioningStatus(code); }

  @Get('provisionings')
  list(@Query('status') s?: string) { return this.svc.listProvisionings(s); }
}
