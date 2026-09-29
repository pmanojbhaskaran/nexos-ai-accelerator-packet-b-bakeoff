/**
 * SSO Controller ΓÇö DOC-000015 (Security Canon)
 * Routes: /auth/sso/google, /auth/sso/google/callback
 *         /auth/sso/saml, /auth/sso/saml/callback
 */
import { Controller, Get, Post, Req, Res, UseGuards , Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { SsoService } from './sso.service';

@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);
  constructor(private readonly ssoService: SsoService) {}

  /** Initiate Google OAuth login */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Guard redirects to Google
  }

  /** Google OAuth callback */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.ssoService.handleSsoCallback(req.user as any, 'google');
    res.redirect(`${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/auth/callback?token=${result.accessToken}`);
  }

  /** Initiate SAML login */
  @Get('saml')
  @UseGuards(AuthGuard('saml'))
  samlLogin() {
    // Guard redirects to IdP
  }

  /** SAML assertion callback (POST) */
  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  async samlCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.ssoService.handleSsoCallback(req.user as any, 'saml');
    res.redirect(`${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/auth/callback?token=${result.accessToken}`);
  }
}
