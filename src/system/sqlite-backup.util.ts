import { BadRequestException } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { existsSync, readFileSync } from 'fs';
import { toLibsqlFileUrl } from '../prisma/sqlite.util';

export const SQLITE_HEADER = 'SQLite format 3';

export const REQUIRED_SQLITE_TABLES = [
  'User',
  'RefreshToken',
  'Category',
  'Product',
  'ProductImage',
  'StockMovement',
  'Remito',
  'RemitoItem',
  'RemitoReturn',
] as const;

export function assertSqliteFileHeader(filePath: string): void {
  if (!existsSync(filePath))
    throw new BadRequestException('El archivo SQLite no existe');

  const header = readFileSync(filePath).subarray(0, SQLITE_HEADER.length);
  if (header.toString('utf8') !== SQLITE_HEADER)
    throw new BadRequestException(
      'El archivo no es una base SQLite válida de MT SHOP',
    );
}

export async function readSqliteTableNames(
  filePath: string,
): Promise<string[]> {
  const client = createClient({ url: toLibsqlFileUrl(filePath) });
  try {
    const result = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    );
    return result.rows.map((row) => String(row.name));
  } catch {
    throw new BadRequestException(
      'No se pudo leer la estructura de la base SQLite',
    );
  } finally {
    client.close();
  }
}

export function quoteSqliteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    throw new BadRequestException('Estructura SQLite inválida');
  return `"${name}"`;
}

export async function assertSqliteBackupStructure(
  filePath: string,
): Promise<void> {
  assertSqliteFileHeader(filePath);

  const tables = await readSqliteTableNames(filePath);
  const missing = REQUIRED_SQLITE_TABLES.filter(
    (table) => !tables.includes(table),
  );

  if (missing.length > 0)
    throw new BadRequestException(
      'El archivo SQLite no tiene la misma estructura que MT SHOP',
    );
}
