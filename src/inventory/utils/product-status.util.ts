import { ProductStatus } from '../../generated/prisma/client';

export const LOW_STOCK_MAX_UNITS = 3;
export const AVAILABLE_MIN_UNITS = 4;

export function resolveProductStatusFromStock(
  stock: number,
  options?: {
    discontinued?: boolean;
    currentStatus?: ProductStatus;
  },
): ProductStatus {
  if (
    options?.discontinued === true ||
    (options?.currentStatus === ProductStatus.DISCONTINUED &&
      options.discontinued !== false)
  ) {
    return ProductStatus.DISCONTINUED;
  }

  if (stock <= 0) return ProductStatus.OUT_OF_STOCK;
  if (stock <= LOW_STOCK_MAX_UNITS) return ProductStatus.LOW_STOCK;
  return ProductStatus.AVAILABLE;
}

export function resolveStatusForSave(
  stock: number,
  requestedStatus?: ProductStatus,
): ProductStatus {
  if (requestedStatus === ProductStatus.DISCONTINUED)
    return ProductStatus.DISCONTINUED;

  return resolveProductStatusFromStock(stock);
}
