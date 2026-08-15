import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories.service';
import type { ImportMode, ImportResult } from './import-result.type';
import { parseArgentinePrice } from '../utils/inventory.utils';

type ParsedCatalogRow = {
  rowNumber: number;
  categoryName: string;
  title: string;
  presentation: string | null;
  price: number;
  description: string | null;
};

@Injectable()
export class CatalogCsvImporter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async import(buffer: Buffer, mode: ImportMode = 'merge'): Promise<ImportResult> {
    const rows = this.parseCsv(buffer);
    const categoryNames = [...new Set(rows.map((row) => row.categoryName))];

    if (mode === 'replace') {
      const categories = await this.prisma.category.findMany({
        where: { name: { in: categoryNames } },
        select: { id: true },
      });
      if (categories.length) {
        await this.prisma.product.deleteMany({
          where: { categoryId: { in: categories.map((c) => c.id) } },
        });
      }
    }

    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const row of rows) {
      try {
        const category = await this.categoriesService.findOrCreateByName(
          row.categoryName,
        );
        const existing = await this.prisma.product.findFirst({
          where: {
            categoryId: category.id,
            title: row.title,
            presentation: row.presentation,
          },
        });

        const data = {
          categoryId: category.id,
          title: row.title,
          presentation: row.presentation,
          description: row.description,
          price: new Prisma.Decimal(row.price),
          stock: 0,
          status: ProductStatus.AVAILABLE,
          sku: null as string | null,
          brand: null as string | null,
        };

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data,
          });
          result.updated += 1;
        } else {
          await this.prisma.product.create({ data });
          result.created += 1;
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return result;
  }

  private parseCsv(buffer: Buffer): ParsedCatalogRow[] {
    const text = buffer.toString('latin1');
    const rows = this.parseCsvRows(text);
    const headerIdx = rows.findIndex((row) => row[0] === 'CATEGORIA');
    if (headerIdx === -1) return [];

    let currentCategory = '';
    const parsed: ParsedCatalogRow[] = [];

    for (let i = headerIdx + 1; i < rows.length; i += 1) {
      const [cat, product, presentation, price, detail] = rows[i];
      if (cat?.trim()) currentCategory = cat.trim();
      if (!product?.trim() || !currentCategory) continue;

      parsed.push({
        rowNumber: i + 1,
        categoryName: currentCategory,
        title: product.trim(),
        presentation: presentation?.trim() || null,
        price: parseArgentinePrice(price),
        description: detail?.trim() || null,
      });
    }

    return parsed;
  }

  private parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i += 1;
          continue;
        }
        if (char === '"') {
          inQuotes = false;
          continue;
        }
        current += char;
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }
      if (char === ',') {
        row.push(current);
        current = '';
        continue;
      }
      if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        if (char === '\r') i += 1;
        continue;
      }
      current += char;
    }

    if (current.length || row.length) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  }
}
