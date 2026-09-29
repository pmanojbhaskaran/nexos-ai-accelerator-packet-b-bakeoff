/**
 * SSO Service ΓÇö DOC-000015 (Security Canon)
 */
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SsoUser {
  email: string;
  displayName?: string;
  provider: 'google' | 'saml';
  photo?: string;
}

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handleSsoCallback(ssoUser: SsoUser, provider: string): Promise<{ accessToken: string }> {
    let user = await (this.prisma as any).userIdentity.findFirst({
      where: { email: ssoUser.email },
    });

    if (!user) {
      user = await (this.prisma as any).userIdentity.create({
        data: {
          tenantCode: 'DEFAULT',
          userCode: `sso_${Date.now()}`,
          authSubject: ssoUser.email,
          displayName: ssoUser.displayName ?? ssoUser.email,
          email: ssoUser.email,
          ssoProvider: provider,
        },
      });
    } else if (!user.ssoProvider) {
      await (this.prisma as any).userIdentity.update({
        where: { id: user.id },
        data: { ssoProvider: provider },
      });
    }

    const payload = { sub: user.id, email: user.email, provider };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
