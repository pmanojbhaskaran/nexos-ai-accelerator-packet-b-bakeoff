/**
 * MFA Service ΓÇö DOC-000015 (Security Canon)
 * TOTP-based multi-factor authentication using otplib v13 functional API.
 */
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
// otplib@13 is ESM; load via CJS bridge so Jest/Nest resolve the require export correctly.
import { generate, generateSecret, generateURI, verify } from './otplib-bridge.cjs';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  async enrollMfa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const secret = await generateSecret();
    const label = user.email ?? userId;
    const otpauthUrl = generateURI({ secret, label, issuer: 'NEXOS-COURIER' });

    await (this.prisma as any).userIdentity.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, otpauthUrl, qrDataUrl: otpauthUrl };
  }

  async verifyAndActivate(userId: string, token: string): Promise<{ success: boolean }> {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('MFA not enrolled ΓÇö call enroll first');

    const result = await verify({ token, secret: user.mfaSecret });
    if (!result.valid) throw new UnauthorizedException('Invalid TOTP token');

    await (this.prisma as any).userIdentity.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { success: true };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) return true;
    const result = await verify({ token, secret: user.mfaSecret });
    return result.valid;
  }

  async disableMfa(userId: string, token: string): Promise<{ success: boolean }> {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new BadRequestException('MFA not enabled');

    const result = await verify({ token, secret: user.mfaSecret });
    if (!result.valid) throw new UnauthorizedException('Invalid token ΓÇö cannot disable MFA');

    await (this.prisma as any).userIdentity.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    return { success: true };
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await (this.prisma as any).userIdentity.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return user?.mfaEnabled ?? false;
  }

  /** Generate a fresh TOTP token for a given secret (admin/debug helper) */
  async generateToken(secret: string): Promise<string> {
    return generate({ secret });
  }
}
