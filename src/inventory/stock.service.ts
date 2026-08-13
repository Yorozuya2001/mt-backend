import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RegisterSaleInput = {
  productId: string;
  quantity: number;
  userId: string;
  reason?: string;
  remitoId?: string;
};

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Descuenta stock por una venta dentro de una transaccion existente.
   *
   * El decremento relativo toma el lock de la fila y devuelve el stock real
   * posterior, asi que dos cajas vendiendo el mismo producto en paralelo se
   * serializan: si el resultado queda negativo la excepcion revierte toda la
   * transaccion y nunca se sobrevende.
   */
  async registerSale(
    tx: Prisma.TransactionClient,
    { productId, quantity, userId, reason, remitoId }: RegisterSaleInput,
  ) {
    const product = await this.decrementStock(tx, productId, quantity);

    if (product.stock < 0)
      throw new BadRequestException(
        `Stock insuficiente para "${product.title}"`,
      );

    const status = this.resolveStatus(
      product.stock,
      product.minStock,
      product.status,
    );

    if (status !== product.status)
      await tx.product.update({ where: { id: productId }, data: { status } });

    await tx.stockMovement.create({
      data: {
        productId,
        type: StockMovementType.SALE,
        quantity,
        reason: reason ?? null,
        remitoId: remitoId ?? null,
        createdById: userId,
      },
    });
  }

  private async decrementStock(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    try {
      return await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException('Producto no encontrado');
      throw error;
    }
  }

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
