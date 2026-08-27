import { BadRequestException } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { toLibsqlFileUrl } from '../prisma/sqlite.util';
import {
  REQUIRED_SQLITE_TABLES,
  assertSqliteBackupStructure,
} from './sqlite-backup.util';

describe('sqlite-backup.util', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mt-sqlite-backup-'));
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // libsql puede dejar el archivo bloqueado en Windows
    }
  });

  it('accepts a sqlite file with the required tables', async () => {
    const filePath = join(dir, 'ok.sqlite');
    const client = createClient({ url: toLibsqlFileUrl(filePath) });
    try {
      for (const table of REQUIRED_SQLITE_TABLES)
        await client.execute(`CREATE TABLE "${table}" (id TEXT)`);
    } finally {
      client.close();
    }

    await expect(assertSqliteBackupStructure(filePath)).resolves.toBeUndefined();
  });

  it('rejects a non-sqlite file', async () => {
    const filePath = join(dir, 'notes.txt');
    writeFileSync(filePath, 'not a database');

    await expect(assertSqliteBackupStructure(filePath)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a sqlite file without the required tables', async () => {
    const filePath = join(dir, 'empty.sqlite');
    const client = createClient({ url: toLibsqlFileUrl(filePath) });
    try {
      await client.execute('CREATE TABLE Extra (id TEXT)');
    } finally {
      client.close();
    }

    await expect(assertSqliteBackupStructure(filePath)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
