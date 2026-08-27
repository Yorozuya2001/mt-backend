import { ProductStatus } from '../../generated/prisma/client';
import { resolveProductStatusFromStock } from './product-status.util';

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'item';
}

export function parseArgentinePrice(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);

  const cleaned = String(value).replace(/[$\s]/g, '').replace(/\./g, '');
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function mapEstadoToStatus(
  estado: string | null | undefined,
  stock: number,
  minStock: number,
): ProductStatus {
  const normalized = (estado ?? '').toLowerCase().trim();

  if (normalized.includes('agotado')) return ProductStatus.OUT_OF_STOCK;
  if (normalized.includes('no disponible')) return ProductStatus.DISCONTINUED;
  if (normalized.includes('volver a comprar')) return ProductStatus.LOW_STOCK;
  if (normalized.includes('en stock')) return ProductStatus.AVAILABLE;
  void minStock;
  return resolveProductStatusFromStock(stock);
}

export function decimalToNumber(value: { toNumber(): number } | number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

export function roundMoney(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function scalePrice(
  value: number,
  percent: number,
  direction: 'increase' | 'decrease',
): number {
  const factor =
    direction === 'increase' ? 1 + percent / 100 : 1 - percent / 100;
  return roundMoney(value * factor);
}
