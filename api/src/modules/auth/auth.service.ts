// auth.service.ts ΓÇö Phase A: Complete authentication lifecycle
// Endpoints: register, login, refresh, me, change-password, request-reset, reset-password
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MINUTES = 30;
const RESET_TOKEN_EXPIRY_HOURS = 24;

function fail(code: string, message: string, status: number = 400): never {
  throw new HttpException({ errors: [{ code, message }] }, status);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  // --- REGISTER (creates user + hashes password) ---
  async register(dto: { tenantCode: string; email: string; password: string; displayName: string; mobileNumber?: string }) {
    if (!dto.email?.trim() || !dto.password || !dto.displayName?.trim()) fail('AUTH_INVALID_INPUT', 'email, password, and displayName are required');
    if (dto.password.length < 8) fail('AUTH_WEAK_PASSWORD', 'Password must be at least 8 characters');

    // Check duplicate
    const existing = await (this.prisma as any).userIdentity.findFirst({ where: { tenantCode: dto.tenantCode, email: dto.email.toLowerCase().trim() } });
    if (existing) fail('AUTH_DUPLICATE_EMAIL', 'Email already registered for this tenant', 409);

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const userCode = 'USR-' + Date.now().toString(36).toUpperCase();
    const user = await (this.prisma as any).userIdentity.create({
      data: {
        tenantCode: dto.tenantCode, userCode, authSubject: dto.email.toLowerCase().trim(),
        displayName: dto.displayName.trim(), email: dto.email.toLowerCase().trim(),
        mobileNumber: dto.mobileNumber || null, passwordHash,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // --- LOGIN ---
  async login(dto: { tenantCode?: string; email: string; password: string }) {
    if (!dto.email?.trim() || !dto.password) fail('AUTH_INVALID_INPUT', 'email and password are required');

    // Look up user by email ΓÇö tenantCode is optional (auto-resolved)
    const where: any = { email: dto.email.toLowerCase().trim() };
    if (dto.tenantCode?.trim()) where.tenantCode = dto.tenantCode.trim();
    const user = await (this.prisma as any).userIdentity.findFirst({
      where,
      include: { roleAssignments: true },
    });
    if (!user) fail('AUTH_ACCOUNT_NOT_FOUND', 'No account found for this email address. Please create an account first.', 404);
    if (!user.isActive) fail('AUTH_ACCOUNT_DISABLED', 'Account is disabled', 403);
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) fail('AUTH_ACCOUNT_LOCKED', `Account locked. Try again after ${new Date(user.lockedUntil).toISOString()}`, 423);
    if (!user.passwordHash) fail('AUTH_NO_PASSWORD', 'Password not set ΓÇö use external auth or reset password', 401);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLogins || 0) + 1;
      const lockUntil = attempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60000) : null;
      await (this.prisma as any).userIdentity.update({ where: { id: user.id }, data: { failedLogins: attempts, lockedUntil: lockUntil } });
      fail('AUTH_WRONG_PASSWORD', `Incorrect password. ${MAX_FAILED_LOGINS - attempts} more attempt${MAX_FAILED_LOGINS - attempts === 1 ? '' : 's'} remaining, or click Forgot Password.`, 401);
    }

    // Reset failed login counter + update lastLoginAt
    await (this.prisma as any).userIdentity.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // --- REFRESH TOKEN ---
  async refresh(dto: { refreshToken: string }) {
    if (!dto.refreshToken) fail('AUTH_INVALID_INPUT', 'refreshToken is required');
    let payload: any;
    try { payload = this.jwt.verify(dto.refreshToken, { secret: process.env.JWT_REFRESH_SECRET || 'bos-refresh-secret-change-in-production' }); } catch { fail('AUTH_INVALID_REFRESH', 'Invalid or expired refresh token', 401); }

    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: payload.sub }, include: { roleAssignments: true } });
    if (!user || !user.isActive) fail('AUTH_USER_NOT_FOUND', 'User not found or inactive', 401);
    if (user.refreshToken !== dto.refreshToken) fail('AUTH_REFRESH_REVOKED', 'Refresh token has been revoked', 401);

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // --- ME (current user profile) ---
  async me(userId: string) {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: userId }, include: { roleAssignments: true } });
    if (!user) fail('AUTH_USER_NOT_FOUND', 'User not found', 404);
    return this.sanitizeUser(user);
  }

  // --- CHANGE PASSWORD ---
  async changePassword(dto: { userId: string; currentPassword: string; newPassword: string }) {
    if (dto.newPassword.length < 8) fail('AUTH_WEAK_PASSWORD', 'Password must be at least 8 characters');
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: dto.userId } });
    if (!user) fail('AUTH_USER_NOT_FOUND', 'User not found', 404);

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash || '');
    if (!valid) fail('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect', 401);

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await (this.prisma as any).userIdentity.update({ where: { id: dto.userId }, data: { passwordHash, refreshToken: null } });
    return { message: 'Password changed successfully. Please log in again.' };
  }

  // --- REQUEST PASSWORD RESET ---
  async requestPasswordReset(dto: { tenantCode: string; email: string }) {
    const user = await (this.prisma as any).userIdentity.findFirst({ where: { tenantCode: dto.tenantCode, email: dto.email.toLowerCase().trim() } });
    // Always return success (don't reveal if email exists)
    if (!user) return { message: 'If this email is registered, a reset link has been sent.' };

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await (this.prisma as any).passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 3600000) } });

    // In production: send email with reset link containing `token`
    this.logger.log(`Password reset token generated for ${dto.email} ΓÇö token: ${token} (send via email in production)`);
    return { message: 'If this email is registered, a reset link has been sent.', _devToken: process.env.NODE_ENV !== 'production' ? token : undefined };
  }

  // --- RESET PASSWORD (with token) ---
  async resetPassword(dto: { token: string; newPassword: string }) {
    if (dto.newPassword.length < 8) fail('AUTH_WEAK_PASSWORD', 'Password must be at least 8 characters');
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const resetRecord = await (this.prisma as any).passwordResetToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } } });
    if (!resetRecord) fail('AUTH_INVALID_RESET_TOKEN', 'Invalid or expired reset token', 400);

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await (this.prisma as any).userIdentity.update({ where: { id: resetRecord.userId }, data: { passwordHash, refreshToken: null, failedLogins: 0, lockedUntil: null } });
    await (this.prisma as any).passwordResetToken.update({ where: { id: resetRecord.id }, data: { usedAt: new Date() } });
    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  // --- LOGOUT (revoke refresh token) ---
  async logout(userId: string) {
    await (this.prisma as any).userIdentity.update({ where: { id: userId }, data: { refreshToken: null } });
    return { message: 'Logged out successfully.' };
  }

  // --- PRIVATE HELPERS ---
  async updateEmail(dto: { userId: string; newEmail: string; password: string }) {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: dto.userId } });
    if (!user) throw new HttpException({ errors: [{ code: 'USER_NOT_FOUND', message: 'User not found' }] }, HttpStatus.NOT_FOUND);
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new HttpException({ errors: [{ code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }] }, HttpStatus.BAD_REQUEST);
    const emailLower = dto.newEmail.toLowerCase().trim();
    const existing = await (this.prisma as any).userIdentity.findFirst({ where: { email: emailLower, id: { not: dto.userId } } });
    if (existing) throw new HttpException({ errors: [{ code: 'EMAIL_EXISTS', message: 'Email already in use by another account' }] }, HttpStatus.CONFLICT);
    await (this.prisma as any).userIdentity.update({ where: { id: dto.userId }, data: { email: emailLower, updatedAt: new Date() } });
    this.logger.log('Email updated for user ' + dto.userId + ' to ' + emailLower);
    return { success: true, email: emailLower };
  }

  async updatePhone(dto: { userId: string; newPhone: string; password: string }) {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: dto.userId } });
    if (!user) throw new HttpException({ errors: [{ code: 'USER_NOT_FOUND', message: 'User not found' }] }, HttpStatus.NOT_FOUND);
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new HttpException({ errors: [{ code: 'INVALID_PASSWORD', message: 'Current password is incorrect' }] }, HttpStatus.BAD_REQUEST);
    const phone = dto.newPhone.replace(/[^0-9+]/g, '').trim();
    await (this.prisma as any).userIdentity.update({ where: { id: dto.userId }, data: { mobileNumber: phone, updatedAt: new Date() } });
    this.logger.log('Phone updated for user ' + dto.userId);
    return { success: true, phone };
  }

  async updateDisplayName(dto: { userId: string; displayName: string }) {
    const user = await (this.prisma as any).userIdentity.findUnique({ where: { id: dto.userId } });
    if (!user) throw new HttpException({ errors: [{ code: 'USER_NOT_FOUND', message: 'User not found' }] }, HttpStatus.NOT_FOUND);
    const name = dto.displayName.trim();
    if (!name) throw new HttpException({ errors: [{ code: 'NAME_REQUIRED', message: 'Display name is required' }] }, HttpStatus.BAD_REQUEST);
    await (this.prisma as any).userIdentity.update({ where: { id: dto.userId }, data: { displayName: name, updatedAt: new Date() } });
    this.logger.log('Display name updated for user ' + dto.userId);
    return { success: true, displayName: name };
  }

  private async generateTokens(user: any) {
    const roles = user.roleAssignments?.map((r: any) => r.roleCode) || [];
    const accessPayload = { sub: user.id, tenantId: user.tenantCode, tenantCode: user.tenantCode, email: user.email, roles, growthState: 'GS-1' };
    const refreshPayload = { sub: user.id, type: 'refresh' };

    const accessToken = this.jwt.sign(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRY, secret: process.env.JWT_SECRET || 'bos-jwt-secret-change-in-production' });
    const refreshToken = this.jwt.sign(refreshPayload, { expiresIn: REFRESH_TOKEN_EXPIRY, secret: process.env.JWT_REFRESH_SECRET || 'bos-refresh-secret-change-in-production' });

    // Store refresh token for revocation support
    await (this.prisma as any).userIdentity.update({ where: { id: user.id }, data: { refreshToken } });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRY };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, refreshToken, ...safe } = user;
    return { ...safe, tenantId: user.tenantCode, roles: user.roleAssignments?.map((r: any) => r.roleCode) || [] };
  }
}
