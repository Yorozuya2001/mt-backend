import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import type { ImportMode, ImportResult } from './import-result.type';
import {
  IMPORT_BATCH_SIZE,
  ImportBatchProcessor,
  type PartsImportRow,
} from './import-batch.processor';
import { parseArgentinePrice } from '../utils/inventory.utils';

type PartHeaderIndices = {
  skuIdx: number;
  titleIdx: number;
  brandIdx: number;
  priceIdx: number;
  stockIdx: number;
  statusIdx: number;
  notesIdx: number;
};

@Injectable()
export class PartsXlsxImporter {
  private readonly logger = new Logger(PartsXlsxImporter.name);

  constructor(private readonly batchProcessor: ImportBatchProcessor) {}

  async import(buffer: Buffer, mode: ImportMode = 'merge'): Promise<ImportResult> {
    this.batchProcessor.clearCategoryCache();

    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const batch: PartsImportRow[] = [];

    const flush = async () => {
      if (!batch.length) return;
      await this.batchProcessor.processPartsRows(batch, result);
      batch.length = 0;
    };

    this.logger.log(
      `Import parts-xlsx (${mode}): ${(buffer.length / 1024).toFixed(1)} KB`,
    );

    await this.streamRows(buffer, mode, async (row) => {
      batch.push(row);
      if (batch.length >= IMPORT_BATCH_SIZE) await flush();
    });

    await flush();

    this.logger.log(
      `Import parts-xlsx listo: +${result.created} ~${result.updated} !${result.skipped}`,
    );

    return result;
  }

  private async streamRows(
    buffer: Buffer,
    mode: ImportMode,
    onRow: (row: PartsImportRow) => Promise<void>,
  ): Promise<void> {
    const stream = Readable.from(buffer);
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      entries: 'ignore',
    });

    for await (const worksheetReader of reader) {
      const categoryName = (worksheetReader.name ?? '').trim();
      if (!categoryName || categoryName === '.') continue;

      if (mode === 'replace')
        await this.batchProcessor.deleteProductsInCategory(categoryName);

      let header: PartHeaderIndices | null = null;

      for await (const row of worksheetReader) {
        const values = row.values as unknown[] | undefined;
        const cells = values ? values.slice(1) : [];
        if (!cells.length) continue;

        if (!header) {
          header = this.parseHeader(cells);
          if (header.titleIdx === -1) break;
          continue;
        }

        const parsed = this.parseDataRow(cells, header, categoryName, row.number);
        if (!parsed) continue;

        await onRow(parsed);
      }
    }
  }

  private parseHeader(cells: unknown[]): PartHeaderIndices {
    const header = cells.map((cell) =>
      String(cell ?? '')
        .trim()
        .toLowerCase(),
    );

    return {
      skuIdx: header.findIndex(
        (value) => value.includes('id de art') || value === 'columna 1',
      ),
      titleIdx: header.findIndex((value) => value.includes('nombre')),
      brandIdx: header.findIndex((value) => value === 'tipo'),
      priceIdx: header.findIndex((value) => value === 'precio'),
      stockIdx: header.findIndex((value) => value === 'stock'),
      statusIdx: header.findIndex((value) => value === 'estado'),
      notesIdx: header.findIndex((value) => value === 'notas'),
    };
  }

  private parseDataRow(
    cells: unknown[],
    header: PartHeaderIndices,
    categoryName: string,
    rowNumber: number,
  ): PartsImportRow | null {
    const title = String(cells[header.titleIdx] ?? '').trim();
    if (!title) return null;

    const skuRaw =
      header.skuIdx >= 0 ? String(cells[header.skuIdx] ?? '').trim() : '';
    const stockRaw = header.stockIdx >= 0 ? cells[header.stockIdx] : '';
    const stock =
      stockRaw !== '' && stockRaw !== null && !Number.isNaN(Number(stockRaw))
        ? Number(stockRaw)
        : 0;

    return {
      rowNumber,
      categoryName,
      sku: skuRaw || null,
      title,
      brand:
        header.brandIdx >= 0
          ? String(cells[header.brandIdx] ?? '').trim() || null
          : null,
      price: parseArgentinePrice(
        header.priceIdx >= 0 ? (cells[header.priceIdx] as string | number) : 0,
      ),
      stock,
      statusText:
        header.statusIdx >= 0
          ? String(cells[header.statusIdx] ?? '').trim() || null
          : null,
      notes:
        header.notesIdx >= 0
          ? String(cells[header.notesIdx] ?? '').trim() || null
          : null,
    };
  }
}
