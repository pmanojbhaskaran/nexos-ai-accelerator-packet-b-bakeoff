// auth.controller.ts ΓÇö Phase A: Public auth endpoints
import { Controller, Post, Get, Body, Req, UseGuards , Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './jwt-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly svc: AuthService) {}

  @Public()
  @Post('register')
  register() { throw new (require('@nestjs/common').HttpException)({ errors: [{ code: 'REGISTER_DISABLED', message: 'Direct registration is disabled. Use POST /api/signup/initiate for the full signup flow.' }] }, 400); }

  @Public()
  @Post('login')
  login(@Body() dto: any) { return this.svc.login(dto); }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: any) { return this.svc.refresh(dto); }

  @Public()
  @Post('request-reset')
  requestReset(@Body() dto: any) { return this.svc.requestPasswordReset(dto); }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: any) { return this.svc.resetPassword(dto); }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) { return this.svc.me(req.user.userId); }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: any, @Body() dto: any) { return this.svc.changePassword({ userId: req.user.userId, ...dto }); }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) { return this.svc.logout(req.user.userId); }

  @UseGuards(JwtAuthGuard)
  @Post('update-email')
  updateEmail(@Req() req: any, @Body() dto: any) { return this.svc.updateEmail({ userId: req.user.userId, ...dto }); }

  @UseGuards(JwtAuthGuard)
  @Post('update-phone')
  updatePhone(@Req() req: any, @Body() dto: any) { return this.svc.updatePhone({ userId: req.user.userId, ...dto }); }

  @UseGuards(JwtAuthGuard)
  @Post('update-display-name')
  updateDisplayName(@Req() req: any, @Body() dto: any) { return this.svc.updateDisplayName({ userId: req.user.userId, ...dto }); }
}
