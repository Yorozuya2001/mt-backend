import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, StockMovementType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(
    productId: string,
    userId: string,
    type: StockMovementType,
    quantity: number,
    reason?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    let nextStock: number;
    let movementQuantity: number;

    if (type === StockMovementType.ADJUSTMENT) {
      nextStock = quantity;
      movementQuantity = Math.abs(nextStock - product.stock);
    } else {
      const delta = this.getStockDelta(type, quantity);
      nextStock = product.stock + delta;
      movementQuantity = quantity;
    }

    if (nextStock < 0)
      throw new BadRequestException('Stock insuficiente para esta operación');

    const status = this.resolveStatus(nextStock, product.minStock, product.status);

    const [movement, updatedProduct] = await this.prisma.$transaction([
      this.prisma.stockMovement.create({
        data: {
          productId,
          type,
          quantity: movementQuantity,
          reason: reason ?? null,
          createdById: userId,
        },
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: { stock: nextStock, status },
      }),
    ]);

    return { movement, stock: updatedProduct.stock, status: updatedProduct.status };
  }

  listMovements(productId: string) {
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: {
          select: { id: true, name: true, lastName: true, email: true },
        },
      },
    });
  }

  private getStockDelta(type: StockMovementType, quantity: number): number {
    if (type === StockMovementType.IN || type === StockMovementType.RETURN)
      return quantity;
    if (type === StockMovementType.OUT || type === StockMovementType.SALE)
      return -quantity;
    return 0;
  }

  private resolveStatus(
    stock: number,
    minStock: number,
    currentStatus: ProductStatus,
  ): ProductStatus {
    if (currentStatus === ProductStatus.DISCONTINUED) return currentStatus;
    if (stock <= 0) return ProductStatus.OUT_OF_STOCK;
    if (stock <= minStock) return ProductStatus.LOW_STOCK;
    return ProductStatus.AVAILABLE;
  }
}
