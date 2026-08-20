import { Prisma } from '../../generated/prisma/client';

export const PRODUCT_GAPS = [
  'sku',
  'barcode',
  'price',
  'wholesale',
  'image',
  'brand',
  'description',
  'stock',
] as const;

export type ProductGap = (typeof PRODUCT_GAPS)[number];

const emptyString = (field: 'sku' | 'barcode' | 'brand' | 'description') => ({
  OR: [{ [field]: null }, { [field]: '' }],
});

export function gapWhere(gap: ProductGap): Prisma.ProductWhereInput {
  if (gap === 'sku') return emptyString('sku');
  if (gap === 'barcode') return emptyString('barcode');
  if (gap === 'brand') return emptyString('brand');
  if (gap === 'description') return emptyString('description');
  if (gap === 'price') return { price: 0 };
  if (gap === 'wholesale') return { wholesalePrice: null };
  if (gap === 'image') return { images: { none: {} } };
  return { stock: 0 };
}

export type ProductGapsCounts = Record<ProductGap, number>;
