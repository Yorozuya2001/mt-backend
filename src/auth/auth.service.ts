import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing)
      throw new ConflictException('Ya existe un usuario con ese email');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = randomBytes(32).toString('hex');

    try {
      await this.usersService.create({
        email: dto.email,
        passwordHash,
        verificationToken,
        name: dto.name,
        lastName: dto.lastName,
      });
    } catch (error) {
      if (this.usersService.isUniqueConstraintError(error))
        throw new ConflictException('Ya existe un usuario con ese email');
      throw error;
    }

    await this.mailService.sendVerificationEmail(
      dto.email,
      verificationToken,
    );

    return {
      message:
        'Registro exitoso. Revisá tu correo para verificar la cuenta.',
    };
  }

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
