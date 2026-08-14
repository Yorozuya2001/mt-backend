import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma, Role, User } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  verificationToken?: string | null;
  isEmailVerified?: boolean;
  role?: Role;
  name?: string;
  lastName?: string;
  dni?: string | null;
  phone?: string | null;
  address?: string | null;
  locality?: string | null;
  isWholesale?: boolean;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  lastName: string;
  dni: string | null;
  phone: string | null;
  address: string | null;
  locality: string | null;
  photoUrl: string | null;
  role: Role;
  isEmailVerified: boolean;
  isWholesale: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      dni: user.dni,
      phone: user.phone,
      address: user.address,
      locality: user.locality,
      photoUrl: user.photoUrl,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isWholesale: user.isWholesale,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  canManage(actorRole: Role, targetRole: Role): boolean {
    if (actorRole === Role.SUPERADMIN)
      return targetRole === Role.CLIENT || targetRole === Role.ADMIN;
    if (actorRole === Role.ADMIN) return targetRole === Role.CLIENT;
    return false;
  }

  canEdit(actorRole: Role, targetRole: Role): boolean {
    return this.canManage(actorRole, targetRole);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByVerificationToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { verificationToken: token },
    });
  }

  findMany(role?: Role): Promise<User[]> {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        password: input.passwordHash,
        verificationToken: input.verificationToken ?? null,
        role: input.role ?? Role.CLIENT,
        name: input.name ?? '',
        lastName: input.lastName ?? '',
        dni: input.dni ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        locality: input.locality ?? null,
        isEmailVerified: input.isEmailVerified ?? false,
        isWholesale: input.isWholesale ?? false,
      },
    });
  }

  async createByAdmin(
    actorRole: Role,
    dto: CreateUserDto,
  ): Promise<{ user: PublicUser; message: string }> {
    const targetRole = (dto.role ?? Role.CLIENT) as Role;

    if (targetRole !== Role.CLIENT && targetRole !== Role.ADMIN)
      throw new ForbiddenException('Rol no permitido');

    if (!this.canManage(actorRole, targetRole))
      throw new ForbiddenException('No tenés permiso para crear este rol');

    const existing = await this.findByEmail(dto.email);
    if (existing)
      throw new ConflictException('Ya existe un usuario con ese email');

    const rawPassword =
      dto.password ??
      (targetRole === Role.CLIENT ? randomBytes(32).toString('hex') : undefined);

    if (!rawPassword)
      throw new BadRequestException(
        'La contraseña es obligatoria para administradores',
      );

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    try {
      if (targetRole === Role.CLIENT) {
        const user = await this.create({
          email: dto.email,
          passwordHash,
          verificationToken: null,
          isEmailVerified: true,
          role: targetRole,
          name: dto.name,
          lastName: dto.lastName,
          dni: dto.dni || null,
          phone: dto.phone || null,
          address: dto.address || null,
          locality: dto.locality || null,
          isWholesale:
            targetRole === Role.CLIENT ? dto.isWholesale ?? false : false,
        });

        return {
          user: this.toPublicUser(user),
          message: 'Cliente creado correctamente.',
        };
      }

      const verificationToken = randomBytes(32).toString('hex');
      const user = await this.create({
        email: dto.email,
        passwordHash,
        verificationToken,
        role: targetRole,
        name: dto.name,
        lastName: dto.lastName,
        dni: dto.dni || null,
        phone: dto.phone || null,
        address: dto.address || null,
        locality: dto.locality || null,
      });

      await this.mailService.sendVerificationEmail(
        dto.email,
        verificationToken,
      );

      return {
        user: this.toPublicUser(user),
        message:
          'Usuario creado. Se envió un correo para verificar la cuenta.',
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw this.toUniqueConstraintException(error);
      throw error;
    }
  }

  async deleteByAdmin(
    actorId: string,
    actorRole: Role,
    targetId: string,
  ): Promise<{ message: string }> {
    if (actorId === targetId)
      throw new ForbiddenException('No podés eliminarte a vos mismo');

    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (target.role === Role.SUPERADMIN)
      throw new ForbiddenException('No se puede eliminar un SUPERADMIN');
    if (!this.canManage(actorRole, target.role))
      throw new ForbiddenException(
        'No tenés permiso para eliminar este usuario',
      );

    await this.prisma.user.delete({ where: { id: targetId } });
    return { message: 'Usuario eliminado correctamente.' };
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        verificationToken: null,
      },
    });
  }

  async updateProfile(
    actorRole: Role,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<PublicUser> {
    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (!this.canEdit(actorRole, target.role))
      throw new ForbiddenException('No tenés permiso para editar este usuario');

    try {
      const updated = await this.prisma.user.update({
        where: { id: targetId },
        data: {
          name: dto.name,
          lastName: dto.lastName,
          dni: dto.dni === undefined ? undefined : dto.dni || null,
          phone: dto.phone === undefined ? undefined : dto.phone || null,
          address: dto.address === undefined ? undefined : dto.address || null,
          locality:
            dto.locality === undefined ? undefined : dto.locality || null,
          isWholesale:
            target.role === Role.CLIENT
              ? dto.isWholesale
              : dto.isWholesale === undefined
                ? undefined
                : false,
        },
      });
      return this.toPublicUser(updated);
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw this.toUniqueConstraintException(error);
      throw error;
    }
  }

  async updatePhotoUrl(
    actorRole: Role,
    targetId: string,
    photoUrl: string,
  ): Promise<PublicUser> {
    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (!this.canEdit(actorRole, target.role))
      throw new ForbiddenException('No tenés permiso para editar este usuario');

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { photoUrl },
    });
    return this.toPublicUser(updated);
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  toUniqueConstraintException(error: unknown): ConflictException {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        if (target.includes('email'))
          return new ConflictException('Ya existe un usuario con ese email');
        if (target.includes('dni'))
          return new ConflictException('El DNI ya está en uso');
      }
    }

    return new ConflictException('Ya existe un usuario con ese email o DNI');
  }
}
