/**
 * Auth Module ΓÇö DOC-000015 (Security Canon)
 * JWT auth + MFA/TOTP + SSO (Google OAuth + SAML)
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TenantProvisioningController } from './tenant-provisioning.controller';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { MfaModule } from './mfa/mfa.module';
import { SsoModule } from './sso/sso.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'bos-dev-secret-change-in-production',
      signOptions: { expiresIn: '8h' },
    }),
    MfaModule,
    SsoModule,
  ],
  controllers: [AuthController, TenantProvisioningController],
  providers: [PrismaService, AuthService, JwtStrategy, TenantProvisioningService],
  exports: [AuthService, JwtModule, MfaModule, SsoModule],
})
export class AuthModule {}
