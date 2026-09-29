import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { GoogleOAuthStrategy } from './google.strategy';
import { SamlStrategy } from './saml.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

// SAML strategy conditionally registered ΓÇö skipped in local dev without SAML_IDP_CERT
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'bos-dev-secret-change-in-production',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [SsoController],
  providers: [PrismaService, SsoService, GoogleOAuthStrategy, ...(process.env.SAML_IDP_CERT ? [SamlStrategy] : [])],
  exports: [SsoService],
})
export class SsoModule {}
