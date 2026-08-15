import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Role } from '../generated/prisma/client';
import {
  PHOTO_STORAGE,
  type PhotoStorage,
} from '../storage/photo-storage.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(PHOTO_STORAGE) private readonly photoStorage: PhotoStorage,
  ) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    const users = await this.usersService.findMany(query.role);
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.usersService.createByAdmin(req.user.role, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.usersService.updateProfile(req.user.role, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.usersService.deleteByAdmin(req.user.id, req.user.role, id);
  }

  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request & { user: AuthUser },
  ) {
    if (!file) throw new BadRequestException('La foto es requerida');
    if (!ALLOWED_MIME.has(file.mimetype))
      throw new BadRequestException('Formato de imagen no permitido');

    const photoUrl = await this.photoStorage.upload({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    return this.usersService.updatePhotoUrl(req.user.role, id, photoUrl);
  }
}
