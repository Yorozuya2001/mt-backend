import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../generated/prisma/client';
import { ListMovementsQueryDto } from './dto/list-movements.query.dto';
import { MovementsService } from './movements.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get('movements/summary')
  summary(@Query() query: ListMovementsQueryDto) {
    return this.movementsService.summary(query);
  }

  @Get('movements')
  list(@Query() query: ListMovementsQueryDto) {
    return this.movementsService.findMany(query);
  }
}
