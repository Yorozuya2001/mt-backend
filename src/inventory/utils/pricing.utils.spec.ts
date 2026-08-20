import { Prisma } from '../../generated/prisma/client';
import { resolveProductUnitPrice } from './pricing.utils';

describe('resolveProductUnitPrice', () => {
  const product = {
    price: new Prisma.Decimal('10.50'),
    wholesalePrice: new Prisma.Decimal('8.25'),
  };

  it('returns retail price when wholesale is off', () => {
    expect(resolveProductUnitPrice(product, false).toString()).toBe('10.5');
  });

  it('returns wholesale price when flagged', () => {
    expect(resolveProductUnitPrice(product, true).toString()).toBe('8.25');
  });

  it('falls back to retail if wholesale is missing', () => {
    const withoutWholesale = { price: product.price, wholesalePrice: null };
    expect(resolveProductUnitPrice(withoutWholesale, true).toString()).toBe(
      '10.5',
    );
  });
});
