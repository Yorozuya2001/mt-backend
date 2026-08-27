import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import type { StringValue } from 'ms';
import { PrismaService } from '../prisma/prisma.service';

export type RefreshCookieOptions = {
  name: string;
  maxAgeMs: number;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string;
};

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiresMs(): number {
    const raw =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '400d';
    return this.parseDurationMs(raw);
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/i.exec(value.trim());
    if (!match) return 400 * 24 * 60 * 60 * 1000;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
  }

  getCookieOptions(): RefreshCookieOptions {
    const secure =
      this.configService.get<string>('COOKIE_SECURE') === 'true';

    return {
      name: this.configService.get<string>('REFRESH_COOKIE_NAME') ?? 'mt_refresh',
      maxAgeMs: this.getRefreshExpiresMs(),
      secure,
      sameSite: secure ? 'none' : 'lax',
      domain: this.configService.get<string>('COOKIE_DOMAIN')?.trim() || undefined,
    };
  }

  setRefreshCookie(res: Response, token: string): void {
    const options = this.getCookieOptions();
    res.cookie(options.name, token, {
      httpOnly: true,
      secure: options.secure,
      sameSite: options.sameSite,
      maxAge: options.maxAgeMs,
      path: '/auth',
      domain: options.domain,
    });
  }

  clearRefreshCookie(res: Response): void {
    const options = this.getCookieOptions();
    res.cookie(options.name, '', {
      httpOnly: true,
      secure: options.secure,
      sameSite: options.sameSite,
      maxAge: 0,
      path: '/auth',
      domain: options.domain,
    });
  }

  async issueRefreshToken(userId: string, res: Response): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.getRefreshExpiresMs());

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    this.setRefreshCookie(res, token);
  }

  async rotateRefreshToken(
    rawToken: string,
    res: Response,
  ): Promise<{ userId: string }> {
    const existing = await this.findValidToken(rawToken);
    if (!existing) throw new UnauthorizedException('Sesión expirada');

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const newToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(newToken);
    const expiresAt = new Date(Date.now() + this.getRefreshExpiresMs());

    await this.prisma.refreshToken.create({
      data: { userId: existing.userId, tokenHash, expiresAt },
    });

    this.setRefreshCookie(res, newToken);

    return { userId: existing.userId };
  }

  async revokeRefreshToken(rawToken: string | undefined, res: Response): Promise<void> {
    this.clearRefreshCookie(res);
    if (!rawToken?.trim()) return;

    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async findValidToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.revokedAt) return null;
    if (record.expiresAt <= new Date()) return null;

    return record;
  }
}
