import { Injectable } from '@nestjs/common';
import { Prisma, Product, ProductStatus, type Category } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories.service';
import { mapEstadoToStatus } from '../utils/inventory.utils';
import type { ImportResult } from './import-result.type';

export const IMPORT_BATCH_SIZE = 50;

export type PartsImportRow = {
  rowNumber: number;
  categoryName: string;
  sku: string | null;
  title: string;
  brand: string | null;
  price: number;
  stock: number;
  statusText: string | null;
  notes: string | null;
};

export type CatalogImportRow = {
  rowNumber: number;
  categoryName: string;
  title: string;
  presentation: string | null;
  price: number;
  description: string | null;
};

@Injectable()
export class ImportBatchProcessor {
  private readonly categoryCache = new Map<string, Category>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  clearCategoryCache(): void {
    this.categoryCache.clear();
  }

  async ensureCategory(name: string): Promise<Category> {
    const trimmed = name.trim();
    const cached = this.categoryCache.get(trimmed);
    if (cached) return cached;

    const category = await this.categoriesService.findOrCreateByName(trimmed);
    this.categoryCache.set(trimmed, category);
    return category;
  }

  async deleteProductsInCategory(categoryName: string): Promise<void> {
    const category = await this.ensureCategory(categoryName);
    await this.prisma.product.deleteMany({ where: { categoryId: category.id } });
  }

  async processPartsRows(rows: PartsImportRow[], result: ImportResult): Promise<void> {
    for (const row of rows) await this.ensureCategory(row.categoryName);

    const skus = [
      ...new Set(
        rows.map((row) => row.sku).filter((sku): sku is string => Boolean(sku)),
      ),
    ];
    const existingBySku = new Map<string, Product>();

    if (skus.length) {
      const found = await this.prisma.product.findMany({
        where: { sku: { in: skus } },
      });
      found.forEach((product) => {
        if (product.sku) existingBySku.set(product.sku, product);
      });
    }

    const noSkuRows = rows.filter((row) => !row.sku);
    const existingByTitle = new Map<string, Product>();

    if (noSkuRows.length) {
      const categoryIds = [
        ...new Set(
          noSkuRows.map(
            (row) => this.categoryCache.get(row.categoryName.trim())!.id,
          ),
        ),
      ];
      const titles = [...new Set(noSkuRows.map((row) => row.title))];
      const found = await this.prisma.product.findMany({
        where: { categoryId: { in: categoryIds }, title: { in: titles } },
      });
      found.forEach((product) =>
        existingByTitle.set(`${product.categoryId}::${product.title}`, product),
      );
    }

    const toCreate: Prisma.ProductCreateManyInput[] = [];

    for (const row of rows) {
      try {
        const category = this.categoryCache.get(row.categoryName.trim())!;
        const status = mapEstadoToStatus(row.statusText, row.stock, 0);
        const data: Prisma.ProductCreateManyInput = {
          categoryId: category.id,
          sku: row.sku,
          title: row.title,
          brand: row.brand,
          price: new Prisma.Decimal(row.price),
          stock: row.stock,
          status,
          description: row.notes,
          presentation: null,
        };

        const existing = row.sku
          ? existingBySku.get(row.sku)
          : existingByTitle.get(`${category.id}::${row.title}`);

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data,
          });
          result.updated += 1;
        } else {
          toCreate.push(data);
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    if (!toCreate.length) return;

    const created = await this.prisma.product.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
    result.created += created.count;
  }

  async processCatalogRows(rows: CatalogImportRow[], result: ImportResult): Promise<void> {
    for (const row of rows) await this.ensureCategory(row.categoryName);

    const categoryIds = [
      ...new Set(
        rows.map((row) => this.categoryCache.get(row.categoryName.trim())!.id),
      ),
    ];
    const titles = [...new Set(rows.map((row) => row.title))];

    const existingProducts = await this.prisma.product.findMany({
      where: { categoryId: { in: categoryIds }, title: { in: titles } },
    });

    const existingByKey = new Map<string, Product>();
    existingProducts.forEach((product) => {
      const key = `${product.categoryId}::${product.title}::${product.presentation ?? ''}`;
      existingByKey.set(key, product);
    });

    const toCreate: Prisma.ProductCreateManyInput[] = [];

    for (const row of rows) {
      try {
        const category = this.categoryCache.get(row.categoryName.trim())!;
        const key = `${category.id}::${row.title}::${row.presentation ?? ''}`;
        const data: Prisma.ProductCreateManyInput = {
          categoryId: category.id,
          title: row.title,
          presentation: row.presentation,
          description: row.description,
          price: new Prisma.Decimal(row.price),
          stock: 0,
          status: ProductStatus.AVAILABLE,
          sku: null,
          brand: null,
        };

        const existing = existingByKey.get(key);

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data,
          });
          result.updated += 1;
        } else {
          toCreate.push(data);
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    if (!toCreate.length) return;

    const created = await this.prisma.product.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
    result.created += created.count;
  }
}
