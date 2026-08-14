import { PaymentMethod } from '../../generated/prisma/client';

export type ReportProductStock = {
  id: string;
  title: string;
  stock: number;
  minStock: number;
};

export type ReportTopProduct = {
  productId: string;
  title: string;
  quantity: number;
  amount: number;
};

export type ReportPaymentEntry = {
  method: PaymentMethod;
  count: number;
  amount: number;
};

export type ReportHourEntry = {
  hour: number;
  count: number;
  amount: number;
};

export type RecommendationsInput = {
  totalCount: number;
  totalAmount: number;
  byPaymentMethod: ReportPaymentEntry[];
  byHour: ReportHourEntry[];
  topProducts: ReportTopProduct[];
  lowStockProducts: ReportProductStock[];
  criticalStockProducts: ReportProductStock[];
};

export function buildRecommendations(input: RecommendationsInput): string[] {
  const recommendations: string[] = [];

  for (const product of input.criticalStockProducts)
    recommendations.push(
      `"${product.title}" tiene solo 1 unidad — reponer urgentemente.`,
    );

  if (input.lowStockProducts.length > 0)
    recommendations.push(
      `${input.lowStockProducts.length} producto(s) con stock bajo — revisar inventario.`,
    );

  if (input.totalCount === 0)
    recommendations.push('Sin ventas registradas en este día.');

  const topProduct = input.topProducts[0];
  if (topProduct)
    recommendations.push(
      `Producto más vendido: "${topProduct.title}" (${topProduct.quantity} unidades). Verificar stock disponible.`,
    );

  if (input.totalAmount > 0) {
    const efectivo = input.byPaymentMethod.find(
      (entry) => entry.method === PaymentMethod.EFECTIVO,
    );
    const transferencia = input.byPaymentMethod.find(
      (entry) => entry.method === PaymentMethod.TRANSFERENCIA,
    );
    const tarjeta = input.byPaymentMethod.find(
      (entry) => entry.method === PaymentMethod.TARJETA,
    );

    const efectivoShare = (efectivo?.amount ?? 0) / input.totalAmount;
    const transferenciaShare = (transferencia?.amount ?? 0) / input.totalAmount;
    const tarjetaShare = (tarjeta?.amount ?? 0) / input.totalAmount;

    if (efectivoShare > 0.7)
      recommendations.push(
        'Más del 70% de las ventas fueron en efectivo — recordar contar la caja al cerrar.',
      );

    if (transferenciaShare > 0.5)
      recommendations.push(
        'Las transferencias representan la mayor parte del día — verificar acreditaciones en el banco.',
      );

    if (tarjetaShare > 0.5)
      recommendations.push(
        'Las ventas con tarjeta dominan el día — revisar liquidaciones del POS.',
      );
  }

  const peakHour = input.byHour.reduce<ReportHourEntry | null>(
    (best, entry) =>
      entry.count > (best?.count ?? 0) ? entry : best,
    null,
  );

  if (peakHour && peakHour.count > 0)
    recommendations.push(
      `Hora pico: ${peakHour.hour}:00 hs con ${peakHour.count} venta(s). Tener personal y stock listos en ese horario.`,
    );

  return recommendations;
}
