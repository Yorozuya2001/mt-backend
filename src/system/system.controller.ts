import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/client';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('info')
  getInfo() {
    return this.systemService.getInfo();
  }
}
