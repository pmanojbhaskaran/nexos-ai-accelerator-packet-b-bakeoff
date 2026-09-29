/**
 * SAML Strategy ΓÇö DOC-000015 (Security Canon)
 * Enterprise SSO via SAML 2.0.
 */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifiedCallback } from 'passport-saml';

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor() {
    super({
      entryPoint: process.env.SAML_ENTRY_POINT ?? 'https://idp.example.com/sso',
      issuer: process.env.SAML_ISSUER ?? 'tenex-system',
      callbackUrl: process.env.SAML_CALLBACK_URL ?? 'http://localhost:3001/auth/sso/saml/callback',
      cert: process.env.SAML_IDP_CERT ?? '',
    });
  }

  async validate(profile: Profile, done: VerifiedCallback): Promise<void> {
    const user = {
      email: profile.nameID,
      displayName: (profile as any)['displayName'] ?? profile.nameID,
      provider: 'saml' as const,
      samlAttributes: profile,
    };
    done(null, user);
  }
}
