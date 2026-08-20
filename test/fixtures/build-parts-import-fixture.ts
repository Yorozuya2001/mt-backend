import * as ExcelJS from 'exceljs';
import { join } from 'path';

export async function writePartsImportFixture(dir: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  const standardSheet = workbook.addWorksheet('BUJIA');
  standardSheet.addRow([
    'ID de artículo',
    'Nombre del elemento',
    'Tipo',
    'Precio',
    'Stock',
    'Estado',
    'Notas',
  ]);
  standardSheet.addRow(['', 'BUJIA CPR8EA 9', 'CG150NGK', 13000, 27, 'En stock']);
  standardSheet.addRow(['', 'BUJIA DPR8EA 9', 'CG150NGK', 12000, 10, 'En stock']);

  const duplicateSkuSheet = workbook.addWorksheet('JUNTAS');
  duplicateSkuSheet.addRow([
    'ID de artículo',
    'Nombre del elemento',
    'Tipo',
    'Precio',
    'Stock',
    'Estado',
    'Notas',
  ]);
  duplicateSkuSheet.addRow(['01MO1620', 'Junta culata A', 'Honda', 500, 5, 'En stock']);
  duplicateSkuSheet.addRow(['01MO1620', 'Junta culata B', 'Honda', 600, 3, 'En stock']);

  const noHeaderSheet = workbook.addWorksheet('ferreteria');
  noHeaderSheet.addRow([]);
  noHeaderSheet.addRow(['', 'ABRAZADERA FILTRO AIRE', '', 1000]);
  noHeaderSheet.addRow(['TOOL53', 'AJUSTA RAYOS', '', 5000]);

  const filePath = join(dir, 'parts-import-fixture.xlsx');
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
