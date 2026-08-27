import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { mkdirSync, writeFileSync } from 'fs';
import { unlink } from 'fs/promises';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PresenceService } from '../auth/presence.service';
import { getDataDir } from '../data-dir';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from './system.service';

const SQLITE_RESTORE_MAX_BYTES = 50 * 1024 * 1024;

@Controller('system')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService,
  ) {}

  @Get('info')
  getInfo() {
    return this.systemService.getInfo();
  }

  @Get('presence')
  getPresence() {
    const users = this.presenceService.listActive();
    return { count: users.length, users };
  }

  @Get('backup')
  async backup(@Res() res: Response) {
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `mt-shop-${stamp}.sqlite`;
    const destinationPath = join(getDataDir(), 'backups', filename);
    await this.prisma.backupTo(destinationPath);

    res.download(destinationPath, filename, async () => {
      await unlink(destinationPath).catch(() => undefined);
    });
  }

  @Post('restore')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SQLITE_RESTORE_MAX_BYTES },
    }),
  )
  async restore(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('El archivo SQLite es requerido');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupsDir = join(getDataDir(), 'backups');
    mkdirSync(backupsDir, { recursive: true });
    const incomingPath = join(backupsDir, `incoming-${stamp}.sqlite`);
    writeFileSync(incomingPath, file.buffer);

    try {
      await this.prisma.restoreFromFile(incomingPath);
      return { ok: true };
    } finally {
      await unlink(incomingPath).catch(() => undefined);
    }
  }
}
