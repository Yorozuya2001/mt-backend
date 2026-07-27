import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Role } from '../generated/prisma/client';
import { CreateRemitoDto } from './dto/create-remito.dto';
import { ListRemitosQueryDto } from './dto/list-remitos.query.dto';
import { RemitosService } from './remitos.service';

@Controller('remitos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class RemitosController {
  constructor(private readonly remitosService: RemitosService) {}

  @Get()
  list(@Query() query: ListRemitosQueryDto) {
    return this.remitosService.findMany(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.remitosService.findById(id);
  }

  @Post()
  create(
    @Body() dto: CreateRemitoDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.remitosService.create(req.user.id, dto);
  }
}
