// jwt.strategy.ts ΓÇö Passport JWT strategy for BOS
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'bos-jwt-secret-change-in-production',
    });
  }

  async validate(payload: any) {
    // payload contains: sub (userId), tenantCode, roles, growthState
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: payload.sub }, include: { roleAssignments: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');
    if ((user as any).lockedUntil && new Date((user as any).lockedUntil) > new Date()) throw new UnauthorizedException('Account is locked');
    return { userId: user.id, tenantCode: user.tenantCode, email: user.email, displayName: user.displayName, roles: user.roleAssignments.map((r: any) => r.roleCode), growthState: payload.growthState || 'GS-1' };
  }
}
