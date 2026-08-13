import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StockMovement,
  StockMovementType,
  User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListMovementsQueryDto } from './dto/list-movements.query.dto';

export type PublicMovementListItem = {
  id: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  product: {
    id: string;
    title: string;
    sku: string | null;
    barcode: string | null;
    categoryId: string;
    categoryName: string;
  };
  createdBy: {
    id: string;
    name: string;
    lastName: string;
    email: string;
  };
  remito: {
    id: string;
    number: number;
    clientId: string | null;
    client: {
      id: string;
      name: string;
      lastName: string;
      email: string;
    } | null;
  } | null;
};

export type PaginatedMovements = {
  items: PublicMovementListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type MovementsSummaryEntry = {
  type: StockMovementType;
  count: number;
  quantity: number;
};

export type MovementsSummary = {
  total: number;
  byType: MovementsSummaryEntry[];
};

type MovementWithRelations = StockMovement & {
  product: {
    id: string;
    title: string;
    sku: string | null;
    barcode: string | null;
    categoryId: string;
    category: { name: string };
  };
  createdBy: Pick<User, 'id' | 'name' | 'lastName' | 'email'>;
  remito: {
    id: string;
    number: number;
    clientId: string | null;
    client: Pick<User, 'id' | 'name' | 'lastName' | 'email'> | null;
  } | null;
};

const MOVEMENT_INCLUDE = {
  product: {
    select: {
      id: true,
      title: true,
      sku: true,
      barcode: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  },
  createdBy: {
    select: { id: true, name: true, lastName: true, email: true },
  },
  remito: {
    select: {
      id: true,
      number: true,
      clientId: true,
      client: {
        select: { id: true, name: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.StockMovementInclude;

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  toPublicMovement(movement: MovementWithRelations): PublicMovementListItem {
    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
      product: {
        id: movement.product.id,
        title: movement.product.title,
        sku: movement.product.sku,
        barcode: movement.product.barcode,
        categoryId: movement.product.categoryId,
        categoryName: movement.product.category.name,
      },
      createdBy: movement.createdBy,
      remito: movement.remito,
    };
  }

  async findMany(query: ListMovementsQueryDto): Promise<PaginatedMovements> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    const [total, movements] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: movements.map((movement) => this.toPublicMovement(movement)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async summary(query: ListMovementsQueryDto): Promise<MovementsSummary> {
    const where = this.buildWhere(query);

    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where,
      _count: { _all: true },
      _sum: { quantity: true },
    });

    const byType = grouped.map((group) => ({
      type: group.type,
      count: group._count._all,
      quantity: group._sum.quantity ?? 0,
    }));

    return {
      total: byType.reduce((acc, entry) => acc + entry.count, 0),
      byType,
    };
  }

  private buildWhere(
    query: ListMovementsQueryDto,
  ): Prisma.StockMovementWhereInput {
    const search = query.search?.trim();
    const createdAt = this.buildDateRange(query.from, query.to);

    return {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.categoryId
        ? { product: { categoryId: query.categoryId } }
        : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              { product: { title: { contains: search, mode: 'insensitive' } } },
              { product: { sku: { contains: search, mode: 'insensitive' } } },
              {
                product: { barcode: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
  }

  /**
   * `to` llega como fecha sin hora desde el filtro del front, por lo que se
   * extiende al final del dia para que el rango sea inclusivo.
   */
  private buildDateRange(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;

    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);

    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }

    return range;
  }
}
