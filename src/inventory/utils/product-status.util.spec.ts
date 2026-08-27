import { ProductStatus } from '../../generated/prisma/client';
import {
  resolveProductStatusFromStock,
  resolveStatusForSave,
} from './product-status.util';

describe('product-status.util', () => {
  it('returns OUT_OF_STOCK for zero stock', () => {
    expect(resolveProductStatusFromStock(0)).toBe(ProductStatus.OUT_OF_STOCK);
  });

  it('returns LOW_STOCK for 1 to 3 units', () => {
    expect(resolveProductStatusFromStock(1)).toBe(ProductStatus.LOW_STOCK);
    expect(resolveProductStatusFromStock(2)).toBe(ProductStatus.LOW_STOCK);
    expect(resolveProductStatusFromStock(3)).toBe(ProductStatus.LOW_STOCK);
  });

  it('returns AVAILABLE for 4 or more units', () => {
    expect(resolveProductStatusFromStock(4)).toBe(ProductStatus.AVAILABLE);
    expect(resolveProductStatusFromStock(10)).toBe(ProductStatus.AVAILABLE);
  });

  it('keeps DISCONTINUED when flagged', () => {
    expect(
      resolveProductStatusFromStock(10, { discontinued: true }),
    ).toBe(ProductStatus.DISCONTINUED);
  });

  it('keeps DISCONTINUED from current status unless explicitly reactivated', () => {
    expect(
      resolveProductStatusFromStock(10, {
        currentStatus: ProductStatus.DISCONTINUED,
      }),
    ).toBe(ProductStatus.DISCONTINUED);
    expect(
      resolveProductStatusFromStock(10, {
        currentStatus: ProductStatus.DISCONTINUED,
        discontinued: false,
      }),
    ).toBe(ProductStatus.AVAILABLE);
  });

  it('resolveStatusForSave honors DISCONTINUED and otherwise recalculates', () => {
    expect(resolveStatusForSave(2, ProductStatus.DISCONTINUED)).toBe(
      ProductStatus.DISCONTINUED,
    );
    expect(resolveStatusForSave(2, ProductStatus.AVAILABLE)).toBe(
      ProductStatus.LOW_STOCK,
    );
  });
});
