import { Injectable, Logger } from '@nestjs/common';
import type { ImportMode, ImportResult } from './import-result.type';
import {
  IMPORT_BATCH_SIZE,
  ImportBatchProcessor,
  type CatalogImportRow,
} from './import-batch.processor';
import { parseArgentinePrice } from '../utils/inventory.utils';

@Injectable()
export class CatalogCsvImporter {
  private readonly logger = new Logger(CatalogCsvImporter.name);

  constructor(private readonly batchProcessor: ImportBatchProcessor) {}

  async import(buffer: Buffer, mode: ImportMode = 'merge'): Promise<ImportResult> {
    this.batchProcessor.clearCategoryCache();

    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const batch: CatalogImportRow[] = [];

    const flush = async () => {
      if (!batch.length) return;
      await this.batchProcessor.processCatalogRows(batch, result);
      batch.length = 0;
    };

    this.logger.log(
      `Import catalog-csv (${mode}): ${(buffer.length / 1024).toFixed(1)} KB`,
    );

    if (mode === 'replace') {
      const categoryNames = this.collectCategoryNames(buffer);
      for (const categoryName of categoryNames)
        await this.batchProcessor.deleteProductsInCategory(categoryName);
    }

    await this.streamRows(buffer, async (row) => {
      batch.push(row);
      if (batch.length >= IMPORT_BATCH_SIZE) await flush();
    });

    await flush();

    this.logger.log(
      `Import catalog-csv listo: +${result.created} ~${result.updated} !${result.skipped}`,
    );

    return result;
  }

  private collectCategoryNames(buffer: Buffer): string[] {
    const rows = this.parseCsvRows(buffer.toString('latin1'));
    const headerIdx = rows.findIndex((row) => row[0] === 'CATEGORIA');
    if (headerIdx === -1) return [];

    const names = new Set<string>();
    let currentCategory = '';

    for (let i = headerIdx + 1; i < rows.length; i += 1) {
      const [cat] = rows[i];
      if (cat?.trim()) currentCategory = cat.trim();
      if (currentCategory) names.add(currentCategory);
    }

    return [...names];
  }

  private async streamRows(
    buffer: Buffer,
    onRow: (row: CatalogImportRow) => Promise<void>,
  ): Promise<void> {
    const rows = this.parseCsvRows(buffer.toString('latin1'));
    const headerIdx = rows.findIndex((row) => row[0] === 'CATEGORIA');
    if (headerIdx === -1) return;

    let currentCategory = '';

    for (let i = headerIdx + 1; i < rows.length; i += 1) {
      const [cat, product, presentation, price, detail] = rows[i];
      if (cat?.trim()) currentCategory = cat.trim();
      if (!product?.trim() || !currentCategory) continue;

      await onRow({
        rowNumber: i + 1,
        categoryName: currentCategory,
        title: product.trim(),
        presentation: presentation?.trim() || null,
        price: parseArgentinePrice(price),
        description: detail?.trim() || null,
      });
    }
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
