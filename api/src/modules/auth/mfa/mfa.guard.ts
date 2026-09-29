/**
 * MFA Guard ΓÇö DOC-000015 (Security Canon)
 * Apply to sensitive routes that require MFA verification.
 * Checks x-mfa-token header or mfaToken in body.
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MfaService } from './mfa.service';

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private readonly mfaService: MfaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub ?? request.user?.id;
    if (!userId) return false;

    const isMfaEnabled = await this.mfaService.isMfaEnabled(userId);
    if (!isMfaEnabled) return true; // MFA not enabled ΓÇö allow through

    const token = request.headers['x-mfa-token'] ?? request.body?.mfaToken;
    if (!token) throw new ForbiddenException('MFA token required for this operation');

    const valid = await this.mfaService.verifyToken(userId, token);
    if (!valid) throw new ForbiddenException('Invalid MFA token');

    return true;
  }
}
