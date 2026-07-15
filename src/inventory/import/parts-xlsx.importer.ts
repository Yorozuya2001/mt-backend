import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories.service';
import type { ImportMode, ImportResult } from './import-result.type';
import {
  mapEstadoToStatus,
  parseArgentinePrice,
} from '../utils/inventory.utils';

type ParsedPartRow = {
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

@Injectable()
export class PartsXlsxImporter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async import(buffer: Buffer, mode: ImportMode = 'merge'): Promise<ImportResult> {
    const rows = await this.parseWorkbook(buffer);
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
        const status = mapEstadoToStatus(row.statusText, row.stock, 0);
        const existing = row.sku
          ? await this.prisma.product.findUnique({ where: { sku: row.sku } })
          : await this.prisma.product.findFirst({
              where: {
                categoryId: category.id,
                title: row.title,
              },
            });

        const data = {
          categoryId: category.id,
          sku: row.sku,
          title: row.title,
          brand: row.brand,
          price: new Prisma.Decimal(row.price),
          stock: row.stock,
          status,
          description: row.notes,
          presentation: null as string | null,
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

  private async parseWorkbook(buffer: Buffer): Promise<ParsedPartRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const parsed: ParsedPartRow[] = [];

    for (const worksheet of workbook.worksheets) {
      const categoryName = worksheet.name.trim();
      if (!categoryName || categoryName === '.') continue;

      const matrix: unknown[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        matrix.push(row.values ? (row.values as unknown[]).slice(1) : []);
      });
      if (!matrix.length) continue;

      const header = matrix[0].map((cell) =>
        String(cell ?? '')
          .trim()
          .toLowerCase(),
      );
      const skuIdx = header.findIndex(
        (h) => h.includes('id de art') || h === 'columna 1',
      );
      const titleIdx = header.findIndex((h) => h.includes('nombre'));
      const brandIdx = header.findIndex((h) => h === 'tipo');
      const priceIdx = header.findIndex((h) => h === 'precio');
      const stockIdx = header.findIndex((h) => h === 'stock');
      const statusIdx = header.findIndex((h) => h === 'estado');
      const notesIdx = header.findIndex((h) => h === 'notas');

      if (titleIdx === -1) continue;

      for (let i = 1; i < matrix.length; i += 1) {
        const row = matrix[i];
        const title = String(row[titleIdx] ?? '').trim();
        if (!title) continue;

        const skuRaw = skuIdx >= 0 ? String(row[skuIdx] ?? '').trim() : '';
        const stockRaw = stockIdx >= 0 ? row[stockIdx] : '';
        const stock =
          stockRaw !== '' && stockRaw !== null && !Number.isNaN(Number(stockRaw))
            ? Number(stockRaw)
            : 0;

        parsed.push({
          rowNumber: i + 1,
          categoryName,
          sku: skuRaw || null,
          title,
          brand:
            brandIdx >= 0 ? String(row[brandIdx] ?? '').trim() || null : null,
          price: parseArgentinePrice(
            priceIdx >= 0 ? (row[priceIdx] as string | number) : 0,
          ),
          stock,
          statusText:
            statusIdx >= 0 ? String(row[statusIdx] ?? '').trim() || null : null,
          notes: notesIdx >= 0 ? String(row[notesIdx] ?? '').trim() || null : null,
        });
      }
    }

    return parsed;
  }
}
