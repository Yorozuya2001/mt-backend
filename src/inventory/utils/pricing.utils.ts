import { Prisma } from '../../generated/prisma/client';

export function resolveProductUnitPrice(
  product: { price: Prisma.Decimal; wholesalePrice: Prisma.Decimal | null },
  applyWholesale: boolean,
): Prisma.Decimal {
  if (!applyWholesale) return product.price;
  return product.wholesalePrice ?? product.price;
}
