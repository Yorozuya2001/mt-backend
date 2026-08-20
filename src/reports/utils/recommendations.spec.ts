import { PaymentMethod } from '../../generated/prisma/client';
import { buildRecommendations } from './recommendations';

describe('buildRecommendations', () => {
  it('reports no sales', () => {
    const result = buildRecommendations({
      totalCount: 0,
      totalAmount: 0,
      byPaymentMethod: [],
      byHour: [],
      topProducts: [],
      lowStockProducts: [],
      criticalStockProducts: [],
    });
    expect(result.some((line) => line.includes('Sin ventas'))).toBe(true);
  });

  it('flags cash-heavy days', () => {
    const result = buildRecommendations({
      totalCount: 2,
      totalAmount: 100,
      byPaymentMethod: [
        { method: PaymentMethod.EFECTIVO, count: 2, amount: 80 },
        { method: PaymentMethod.TARJETA, count: 0, amount: 20 },
      ],
      byHour: [{ hour: 11, count: 2, amount: 100 }],
      topProducts: [
        { productId: '1', title: 'Filtro', quantity: 3, amount: 100 },
      ],
      lowStockProducts: [{ id: '1', title: 'Filtro', stock: 2, minStock: 5 }],
      criticalStockProducts: [
        { id: '2', title: 'Bujia', stock: 1, minStock: 3 },
      ],
    });

    expect(result.join(' ')).toContain('efectivo');
    expect(result.join(' ')).toContain('Bujia');
    expect(result.join(' ')).toContain('Filtro');
  });
});
