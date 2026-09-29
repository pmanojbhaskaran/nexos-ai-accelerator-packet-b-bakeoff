import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BakeoffDimensioningService } from './bakeoff-dimensioning.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { resolveAuthenticatedBakeoffContext } from '../../common/bakeoff/authenticated-context';

/** NEW_BAKEOFF_CONTRACT_REQUIRED — not a production NEXOS endpoint. */
@Controller('bakeoff/v1')
@UseGuards(JwtAuthGuard)
export class BakeoffDimensioningController {
  constructor(private readonly service: BakeoffDimensioningService) {}

  @Get('packages/resolve')
  resolvePackage(@Req() req: Record<string, unknown>, @Query('barcode') barcode?: string) {
    const ctx = resolveAuthenticatedBakeoffContext(req as any);
    return this.service.resolvePackage(ctx.tenantId, String(barcode ?? ''), ctx.actorId);
  }

  @Post('packages/:packageId/provisional-dimensions')
  submitProvisional(
    @Req() req: Record<string, unknown>,
    @Param('packageId') packageId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const ctx = resolveAuthenticatedBakeoffContext(req as any);
    return this.service.submitProvisional(ctx.tenantId, ctx.actorId, packageId, body);
  }

  @Post('evidence')
  uploadEvidence(@Req() req: Record<string, unknown>, @Body() body: Record<string, unknown>) {
    const ctx = resolveAuthenticatedBakeoffContext(req as any);
    return this.service.registerEvidence(ctx.tenantId, ctx.actorId, body);
  }
}
