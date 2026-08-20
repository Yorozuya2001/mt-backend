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

type StreamWorksheetReader = ExcelJS.stream.xlsx.WorksheetReader & {
  name?: string;
};

type PartHeaderIndices = {
  skuIdx: number;
  titleIdx: number;
  brandIdx: number;
  priceIdx: number;
  stockIdx: number;
  statusIdx: number;
  notesIdx: number;
};

type ScannedRow = {
  cells: unknown[];
  rowNumber: number;
};

const HEADER_SCAN_ROWS = 5;

const DEFAULT_PARTS_HEADER: PartHeaderIndices = {
  skuIdx: 0,
  titleIdx: 1,
  brandIdx: 2,
  priceIdx: 3,
  stockIdx: 4,
  statusIdx: 5,
  notesIdx: 6,
};

const SKIP_SHEET_NAMES = new Set(['.', ',']);

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

    await this.streamRows(buffer, mode, result, async (row) => {
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
    result: ImportResult,
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
      const categoryName = (
        (worksheetReader as StreamWorksheetReader).name ?? ''
      ).trim();
      if (!categoryName || SKIP_SHEET_NAMES.has(categoryName)) continue;

      try {
        if (mode === 'replace')
          await this.batchProcessor.deleteProductsInCategory(categoryName);

        let rowsRead = 0;

        const emitRow = async (parsed: PartsImportRow | null) => {
          if (!parsed) return;
          rowsRead += 1;
          await onRow(parsed);
        };

        let header: PartHeaderIndices | null = null;
        const scannedRows: ScannedRow[] = [];

        const flushScannedRows = async (
          resolvedHeader: PartHeaderIndices,
          headerRowIndex: number,
        ) => {
          for (let i = headerRowIndex + 1; i < scannedRows.length; i++) {
            const scanned = scannedRows[i]!;
            await emitRow(
              this.parseDataRow(
                scanned.cells,
                resolvedHeader,
                categoryName,
                scanned.rowNumber,
              ),
            );
          }
        };

        const useDefaultHeaderForScanned = async () => {
          header = DEFAULT_PARTS_HEADER;
          for (const scanned of scannedRows) {
            await emitRow(
              this.parseDataRow(
                scanned.cells,
                header,
                categoryName,
                scanned.rowNumber,
              ),
            );
          }
          scannedRows.length = 0;
        };

        for await (const row of worksheetReader) {
          const values = row.values as unknown[] | undefined;
          const cells = values ? values.slice(1) : [];
          if (!cells.length) continue;

          if (!header) {
            scannedRows.push({ cells, rowNumber: row.number });

            const resolved = this.findHeaderInScannedRows(scannedRows);
            if (resolved) {
              header = resolved.header;
              await flushScannedRows(header, resolved.headerRowIndex);
              scannedRows.length = 0;
              continue;
            }

            if (scannedRows.length >= HEADER_SCAN_ROWS)
              await useDefaultHeaderForScanned();

            continue;
          }

          await emitRow(
            this.parseDataRow(cells, header, categoryName, row.number),
          );
        }

        if (!header && scannedRows.length) {
          const resolved = this.findHeaderInScannedRows(scannedRows);
          if (resolved) {
            header = resolved.header;
            await flushScannedRows(header, resolved.headerRowIndex);
          } else {
            await useDefaultHeaderForScanned();
          }
        }

        this.logger.log(`Sheet "${categoryName}": ${rowsRead} filas leídas`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        result.errors.push({ row: categoryName, message });
        this.logger.warn(`Sheet "${categoryName}" omitida: ${message}`);
      }
    }
  }

  private findHeaderInScannedRows(
    scannedRows: ScannedRow[],
  ): { header: PartHeaderIndices; headerRowIndex: number } | null {
    for (let i = 0; i < scannedRows.length; i++) {
      const parsed = this.tryParseHeader(scannedRows[i]!.cells);
      if (parsed) return { header: parsed, headerRowIndex: i };
    }
    return null;
  }

  private tryParseHeader(cells: unknown[]): PartHeaderIndices | null {
    const header = this.parseHeader(cells);
    return header.titleIdx >= 0 ? header : null;
  }

  private parseHeader(cells: unknown[]): PartHeaderIndices {
    const header = cells.map((cell) =>
      String(cell ?? '')
        .trim()
        .toLowerCase(),
    );

    return {
      skuIdx: header.findIndex(
        (value) =>
          (value ?? '').includes('id de art') || value === 'columna 1',
      ),
      titleIdx: header.findIndex((value) => (value ?? '').includes('nombre')),
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
