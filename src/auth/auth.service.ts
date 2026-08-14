import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

  async login(dto: LoginDto) {
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

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    return this.usersService.toPublicUser(user);
  }
}
