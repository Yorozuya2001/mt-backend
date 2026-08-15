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

export type RegisterReturnInput = {
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

  async registerReturn(
    tx: Prisma.TransactionClient,
    { productId, quantity, userId, reason, remitoId }: RegisterReturnInput,
  ) {
    const product = await this.incrementStock(tx, productId, quantity);

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
        type: StockMovementType.RETURN,
        quantity,
        reason: reason ?? null,
        remitoId: remitoId ?? null,
        createdById: userId,
      },
    });
  }

  async voidMovement(movementId: string, userId: string, reason?: string) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { product: true },
    });

    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    if (movement.voidedAt)
      throw new BadRequestException('El movimiento ya fue anulado');
    if (movement.type === StockMovementType.SALE)
      throw new BadRequestException(
        'Las ventas se anulan desde el remito asociado',
      );

    const product = movement.product;
    let nextStock = product.stock;

    if (movement.type === StockMovementType.IN)
      nextStock = product.stock - movement.quantity;
    else if (movement.type === StockMovementType.OUT)
      nextStock = product.stock + movement.quantity;
    else if (movement.type === StockMovementType.RETURN)
      nextStock = product.stock - movement.quantity;
    else if (movement.type === StockMovementType.ADJUSTMENT) {
      if (movement.previousStock == null)
        throw new BadRequestException(
          'No se puede anular este ajuste por falta de historial',
        );
      nextStock = movement.previousStock;
    }

    if (nextStock < 0)
      throw new BadRequestException(
        'Stock insuficiente para anular este movimiento',
      );

    const status = this.resolveStatus(
      nextStock,
      product.minStock,
      product.status,
    );

    await this.prisma.$transaction([
      this.prisma.stockMovement.update({
        where: { id: movementId },
        data: {
          voidedAt: new Date(),
          voidedById: userId,
          reason: reason?.trim() || movement.reason,
        },
      }),
      this.prisma.product.update({
        where: { id: product.id },
        data: { stock: nextStock, status },
      }),
    ]);

    return { id: movementId, voidedAt: new Date() };
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

  private async incrementStock(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    try {
      return await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
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
    let previousStock: number | null = null;

    if (type === StockMovementType.ADJUSTMENT) {
      previousStock = product.stock;
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
          previousStock,
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
