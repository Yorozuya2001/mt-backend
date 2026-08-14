import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
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
import { ListMovementsQueryDto } from './dto/list-movements.query.dto';
import { VoidMovementDto } from './dto/void-movement.dto';
import { MovementsService } from './movements.service';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class MovementsController {
  constructor(
    private readonly movementsService: MovementsService,
    private readonly stockService: StockService,
  ) {}

  @Get('movements/summary')
  summary(@Query() query: ListMovementsQueryDto) {
    return this.movementsService.summary(query);
  }

  @Get('movements')
  list(@Query() query: ListMovementsQueryDto) {
    return this.movementsService.findMany(query);
  }

  @Post('movements/:id/void')
  voidMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidMovementDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.stockService.voidMovement(id, req.user.id, dto.reason);
  }
}
