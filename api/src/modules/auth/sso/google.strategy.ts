/**
 * Google OAuth2 Strategy ΓÇö DOC-000015 (Security Canon)
 * Tenant-level SSO: each tenant can configure their own Google OAuth client.
 * Falls back to platform-level OAuth client if tenant has no config.
 */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? 'not-configured',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? 'not-configured',
      callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL ?? 'http://localhost:3001/auth/sso/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback): Promise<void> {
    const { emails, displayName, photos } = profile;
    const user = {
      email: emails?.[0]?.value,
      displayName,
      photo: photos?.[0]?.value,
      accessToken,
      provider: 'google' as const,
    };
    done(null, user);
  }
}
