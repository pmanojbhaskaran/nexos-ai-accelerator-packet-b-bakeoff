/**
 * MFA Controller ΓÇö DOC-000015 (Security Canon)
 * Endpoints: enroll, verify, disable, status
 */
import { Controller, Post, Delete, Get, Body, Req, UseGuards , Logger } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../jwt-auth.guard';

@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  private readonly logger = new Logger(MfaController.name);
  constructor(private readonly mfaService: MfaService) {}

  /** Start MFA enrollment ΓÇö returns secret + QR URI */
  @Post('enroll')
  async enroll(@Req() req: any) {
    return this.mfaService.enrollMfa(req.user?.sub ?? req.user?.id);
  }

  /** Verify TOTP token and activate MFA */
  @Post('verify')
  async verify(@Req() req: any, @Body() body: { token: string }) {
    return this.mfaService.verifyAndActivate(req.user?.sub ?? req.user?.id, body.token);
  }

  /** Disable MFA (requires valid token as confirmation) */
  @Delete('disable')
  async disable(@Req() req: any, @Body() body: { token: string }) {
    return this.mfaService.disableMfa(req.user?.sub ?? req.user?.id, body.token);
  }

  /** Check MFA status */
  @Get('status')
  async status(@Req() req: any) {
    const enabled = await this.mfaService.isMfaEnabled(req.user?.sub ?? req.user?.id);
    return { mfaEnabled: enabled };
  }
}
