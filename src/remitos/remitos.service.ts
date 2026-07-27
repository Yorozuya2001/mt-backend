import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  Product,
  Remito,
  RemitoItem,
  Role,
  User,
} from '../generated/prisma/client';
import { StockService } from '../inventory/stock.service';
import { decimalToNumber } from '../inventory/utils/inventory.utils';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRemitoDto,
  CreateRemitoItemDto,
} from './dto/create-remito.dto';
import type { ListRemitosQueryDto } from './dto/list-remitos.query.dto';

export type PublicRemitoItem = {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type PublicRemitoClient = {
  id: string;
  name: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  locality: string | null;
};

export type PublicRemito = {
  id: string;
  number: number;
  paymentMethod: PaymentMethod;
  total: number;
  notes: string | null;
  createdAt: Date;
  client: PublicRemitoClient | null;
  createdBy: { id: string; name: string; lastName: string } | null;
  items: PublicRemitoItem[];
};

export type PaginatedRemitos = {
  items: PublicRemito[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type RemitoWithRelations = Remito & {
  items: RemitoItem[];
  client: Pick<
    User,
    'id' | 'name' | 'lastName' | 'phone' | 'address' | 'locality'
  > | null;
  createdBy: Pick<User, 'id' | 'name' | 'lastName'> | null;
};

type RemitoLine = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
};

const REMITO_INCLUDE = {
  items: true,
  client: {
    select: {
      id: true,
      name: true,
      lastName: true,
      phone: true,
      address: true,
      locality: true,
    },
  },
  createdBy: { select: { id: true, name: true, lastName: true } },
} as const;

@Injectable()
export class RemitosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  toPublicRemito(remito: RemitoWithRelations): PublicRemito {
    return {
      id: remito.id,
      number: remito.number,
      paymentMethod: remito.paymentMethod,
      total: decimalToNumber(remito.total) ?? 0,
      notes: remito.notes,
      createdAt: remito.createdAt,
      client: remito.client,
      createdBy: remito.createdBy,
      items: remito.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: decimalToNumber(item.unitPrice) ?? 0,
        subtotal: decimalToNumber(item.subtotal) ?? 0,
      })),
    };
  }

  async create(
    createdById: string,
    dto: CreateRemitoDto,
  ): Promise<PublicRemito> {
    await this.ensureClientExists(dto.clientId);

    // Un remito puede llevar decenas de items y cada uno mueve stock, asi que se
    // amplia el limite por defecto de 5s de las transacciones interactivas.
    const remito = await this.prisma.$transaction(
      async (tx) => {
        const products = await this.findLineProducts(tx, dto.items);
        const lines = dto.items.map((item) =>
          this.buildLine(
            item,
            item.productId ? products.get(item.productId) : undefined,
          ),
        );
        const total = lines.reduce(
          (accumulator, line) => accumulator.add(line.subtotal),
          new Prisma.Decimal(0),
        );

        const created = await tx.remito.create({
          data: {
            clientId: dto.clientId ?? null,
            createdById,
            paymentMethod: dto.paymentMethod,
            notes: dto.notes?.trim() || null,
            total,
            items: { create: lines },
          },
          include: REMITO_INCLUDE,
        });

        for (const line of lines) {
          if (!line.productId) continue;
          await this.stockService.registerSale(tx, {
            productId: line.productId,
            quantity: line.quantity,
            userId: createdById,
            reason: `Remito X #${created.number}`,
          });
        }

        return created;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return this.toPublicRemito(remito);
  }

  async findMany(query: ListRemitosQueryDto): Promise<PaginatedRemitos> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.RemitoWhereInput = query.clientId
      ? { clientId: query.clientId }
      : {};

    const [total, remitos] = await this.prisma.$transaction([
      this.prisma.remito.count({ where }),
      this.prisma.remito.findMany({
        where,
        include: REMITO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: remitos.map((remito) => this.toPublicRemito(remito)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findById(id: string): Promise<PublicRemito> {
    const remito = await this.prisma.remito.findUnique({
      where: { id },
      include: REMITO_INCLUDE,
    });
    if (!remito) throw new NotFoundException('Remito no encontrado');
    return this.toPublicRemito(remito);
  }

  private async ensureClientExists(clientId?: string) {
    if (!clientId) return;

    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { role: true },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    if (client.role !== Role.CLIENT)
      throw new BadRequestException('El destinatario debe ser un cliente');
  }

  private async findLineProducts(
    tx: Prisma.TransactionClient,
    items: CreateRemitoItemDto[],
  ): Promise<Map<string, Product>> {
    const productIds = [
      ...new Set(
        items
          .map((item) => item.productId)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    ];
    if (productIds.length === 0) return new Map();

    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length)
      throw new NotFoundException('Alguno de los productos ya no existe');

    return new Map(products.map((product) => [product.id, product]));
  }

  /**
   * El precio unitario y el subtotal siempre se resuelven en el servidor:
   * para productos del inventario se usa el precio vigente y para items
   * manuales el precio enviado, nunca el total calculado por el cliente.
   */
  private buildLine(item: CreateRemitoItemDto, product?: Product): RemitoLine {
    if (!product) {
      const description = item.description?.trim();
      if (!description)
        throw new BadRequestException('El ítem manual necesita descripción');

      const unitPrice = new Prisma.Decimal(item.unitPrice ?? 0);
      return {
        productId: null,
        description,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice.mul(item.quantity),
      };
    }

    const unitPrice = product.discountPrice ?? product.price;
    return {
      productId: product.id,
      description: item.description?.trim() || product.title,
      quantity: item.quantity,
      unitPrice,
      subtotal: unitPrice.mul(item.quantity),
    };
  }
}
