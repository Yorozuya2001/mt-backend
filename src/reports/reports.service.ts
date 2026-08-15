import { Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  ProductStatus,
} from '../generated/prisma/client';
import { decimalToNumber } from '../inventory/utils/inventory.utils';
import { PrismaService } from '../prisma/prisma.service';
import type { DailyReportQueryDto } from './dto/daily-report.query.dto';
import {
  buildRecommendations,
  type ReportHourEntry,
  type ReportPaymentEntry,
  type ReportProductStock,
  type ReportTopProduct,
} from './utils/recommendations';

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.EFECTIVO,
  PaymentMethod.TRANSFERENCIA,
  PaymentMethod.TARJETA,
];

export type DailyReportProductStock = ReportProductStock;

export type DailyReportTopProduct = ReportTopProduct;

export type DailyReportPaymentEntry = ReportPaymentEntry;

export type DailyReportHourEntry = ReportHourEntry;

export type DailyReportSales = {
  totalAmount: number;
  totalCount: number;
  byPaymentMethod: DailyReportPaymentEntry[];
  byHour: DailyReportHourEntry[];
};

export type DailyReport = {
  date: string;
  sales: DailyReportSales;
  topProducts: DailyReportTopProduct[];
  lowStockProducts: DailyReportProductStock[];
  criticalStockProducts: DailyReportProductStock[];
  recommendations: string[];
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(query: DailyReportQueryDto): Promise<DailyReport> {
    const date = query.date ?? this.formatDate(new Date());
    const { start, end } = this.buildDayRange(date);
    const remitoWhere: Prisma.RemitoWhereInput = {
      createdAt: { gte: start, lt: end },
    };

    const [remitos, lowStockProducts, criticalStockProducts] =
      await this.prisma.$transaction([
        this.prisma.remito.findMany({
          where: remitoWhere,
          select: {
            paymentMethod: true,
            total: true,
            createdAt: true,
            voidedAt: true,
            items: {
              select: {
                productId: true,
                quantity: true,
                returnedQuantity: true,
                unitPrice: true,
                subtotal: true,
                product: { select: { title: true } },
              },
            },
          },
        }),
        this.prisma.product.findMany({
          where: {
            isActive: true,
            status: ProductStatus.LOW_STOCK,
          },
          select: {
            id: true,
            title: true,
            stock: true,
            minStock: true,
          },
          orderBy: { stock: 'asc' },
        }),
        this.prisma.product.findMany({
          where: {
            isActive: true,
            stock: 1,
            status: { not: ProductStatus.DISCONTINUED },
          },
          select: {
            id: true,
            title: true,
            stock: true,
            minStock: true,
          },
          orderBy: { title: 'asc' },
        }),
      ]);

    const byPaymentMethod = this.aggregatePaymentMethods(remitos);
    const totalAmount = byPaymentMethod.reduce(
      (acc, entry) => acc + entry.amount,
      0,
    );
    const totalCount = remitos.filter((remito) => !remito.voidedAt).length;
    const byHour = this.aggregateByHour(remitos);
    const topProducts = this.aggregateTopProducts(remitos);

    const mappedLowStock = lowStockProducts.map((product) => ({
      id: product.id,
      title: product.title,
      stock: product.stock,
      minStock: product.minStock,
    }));

    const mappedCritical = criticalStockProducts.map((product) => ({
      id: product.id,
      title: product.title,
      stock: product.stock,
      minStock: product.minStock,
    }));

    const recommendations = buildRecommendations({
      totalCount,
      totalAmount,
      byPaymentMethod,
      byHour,
      topProducts,
      lowStockProducts: mappedLowStock,
      criticalStockProducts: mappedCritical,
    });

    return {
      date,
      sales: {
        totalAmount,
        totalCount,
        byPaymentMethod,
        byHour,
      },
      topProducts,
      lowStockProducts: mappedLowStock,
      criticalStockProducts: mappedCritical,
      recommendations,
    };
  }

  private getRemitoNetTotal(
    remito: {
      voidedAt: Date | null;
      total: Prisma.Decimal;
      items: Array<{
        returnedQuantity: number;
        unitPrice: Prisma.Decimal;
      }>;
    },
  ): number {
    if (remito.voidedAt) return 0;

    const returnedAmount = remito.items.reduce(
      (acc, item) =>
        acc + (decimalToNumber(item.unitPrice) ?? 0) * item.returnedQuantity,
      0,
    );

    return Math.max(0, (decimalToNumber(remito.total) ?? 0) - returnedAmount);
  }

  private aggregatePaymentMethods(
    remitos: Array<{
      paymentMethod: PaymentMethod;
      total: Prisma.Decimal;
      voidedAt: Date | null;
      items: Array<{
        returnedQuantity: number;
        unitPrice: Prisma.Decimal;
      }>;
    }>,
  ): DailyReportPaymentEntry[] {
    const byMethod = new Map<PaymentMethod, DailyReportPaymentEntry>();

    for (const remito of remitos) {
      if (remito.voidedAt) continue;

      const net = this.getRemitoNetTotal(remito);
      const current = byMethod.get(remito.paymentMethod) ?? {
        method: remito.paymentMethod,
        count: 0,
        amount: 0,
      };

      current.count += 1;
      current.amount += net;
      byMethod.set(remito.paymentMethod, current);
    }

    return PAYMENT_METHODS.map(
      (method) =>
        byMethod.get(method) ?? { method, count: 0, amount: 0 },
    );
  }

  private aggregateByHour(
    remitos: Array<{
      total: Prisma.Decimal;
      createdAt: Date;
      voidedAt: Date | null;
      items: Array<{
        returnedQuantity: number;
        unitPrice: Prisma.Decimal;
      }>;
    }>,
  ): DailyReportHourEntry[] {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      amount: 0,
    }));

    for (const remito of remitos) {
      if (remito.voidedAt) continue;

      const hour = remito.createdAt.getHours();
      buckets[hour].count += 1;
      buckets[hour].amount += this.getRemitoNetTotal(remito);
    }

    return buckets;
  }

  private aggregateTopProducts(
    remitos: Array<{
      voidedAt: Date | null;
      items: Array<{
        productId: string | null;
        quantity: number;
        returnedQuantity: number;
        unitPrice: Prisma.Decimal;
        product: { title: string } | null;
      }>;
    }>,
  ): DailyReportTopProduct[] {
    const aggregated = new Map<string, DailyReportTopProduct>();

    for (const remito of remitos) {
      if (remito.voidedAt) continue;

      for (const item of remito.items) {
        if (!item.productId) continue;

        const netQty = item.quantity - item.returnedQuantity;
        if (netQty <= 0) continue;

        const amount = (decimalToNumber(item.unitPrice) ?? 0) * netQty;
        const existing = aggregated.get(item.productId);

        if (existing) {
          existing.quantity += netQty;
          existing.amount += amount;
          continue;
        }

        aggregated.set(item.productId, {
          productId: item.productId,
          title: item.product?.title ?? 'Producto',
          quantity: netQty,
          amount,
        });
      }
    }

    return [...aggregated.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

  private buildDayRange(date: string): { start: Date; end: Date } {
    const [year, month, day] = date.split('-').map(Number)

    if (!year || !month || !day)
      return this.buildDayRange(this.formatDate(new Date()))

    // Usar componentes locales: `new Date("YYYY-MM-DD")` interpreta UTC y desplaza el día.
    const start = new Date(year, month - 1, day, 0, 0, 0, 0)
    const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0)

    return { start, end }
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
