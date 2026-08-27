import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Role } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
  ) {}

  async verifyEmail(token: string) {
    if (!token?.trim())
      throw new BadRequestException('Token de verificación inválido');

    const user = await this.usersService.findByVerificationToken(token);
    if (!user)
      throw new BadRequestException('Token de verificación inválido o expirado');

    if (user.isEmailVerified)
      return { message: 'El correo ya estaba verificado.' };

    await this.usersService.markEmailVerified(user.id);

    return { message: 'Correo verificado correctamente.' };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user)
      throw new UnauthorizedException('Credenciales inválidas');

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid)
      throw new UnauthorizedException('Credenciales inválidas');

    if (user.role === Role.CLIENT)
      throw new ForbiddenException('Los clientes no pueden iniciar sesión.');

    if (!user.isEmailVerified)
      throw new ForbiddenException(
        'Verificá tu correo electrónico antes de iniciar sesión.',
      );

    await this.refreshTokenService.issueRefreshToken(user.id, res);

    return {
      access_token: await this.signAccessToken(user.id, user.email, user.role),
    };
  }

  async refresh(req: Request, res: Response) {
    const cookieName =
      this.configService.get<string>('REFRESH_COOKIE_NAME') ?? 'mt_refresh';
    const rawToken = req.cookies?.[cookieName] as string | undefined;

    if (!rawToken?.trim())
      throw new UnauthorizedException('Sesión expirada');

    const { userId } = await this.refreshTokenService.rotateRefreshToken(
      rawToken,
      res,
    );

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Sesión expirada');

    return {
      access_token: await this.signAccessToken(user.id, user.email, user.role),
    };
  }

  async logout(req: Request, res: Response) {
    const cookieName =
      this.configService.get<string>('REFRESH_COOKIE_NAME') ?? 'mt_refresh';
    const rawToken = req.cookies?.[cookieName] as string | undefined;

    await this.refreshTokenService.revokeRefreshToken(rawToken, res);

    return { message: 'Sesión cerrada' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    return this.usersService.toPublicUser(user);
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    await this.usersService.changeOwnPassword(
      userId,
      currentPassword,
      newPassword,
    );
    await this.refreshTokenService.revokeAllForUser(userId);
    return { message: 'Contraseña actualizada. Volvé a iniciar sesión.' };
  }

  private async signAccessToken(
    userId: string,
    email: string,
    role: Role,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    return this.jwtService.signAsync(payload);
  }
}
