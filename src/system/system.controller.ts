import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { getDataDir } from '../data-dir';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('info')
  getInfo() {
    return this.systemService.getInfo();
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
}
