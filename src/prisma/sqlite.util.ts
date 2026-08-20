import { PrismaLibSql } from '@prisma/adapter-libsql';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  getDatabasePath,
  resolveDatabaseUrl,
} from '../data-dir';
import { PrismaClient } from '../generated/prisma/client';

export type SqlitePrismaHandle = {
  prisma: PrismaClient;
  sqlitePath: string;
};

export function toLibsqlFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('file:')) return normalized;
  return `file:${normalized}`;
}

export function createSqliteAdapter(databaseUrl?: string): {
  adapter: PrismaLibSql;
  sqlitePath: string;
} {
  if (databaseUrl && !process.env.DATABASE_URL)
    process.env.DATABASE_URL = databaseUrl;
  else if (!process.env.DATABASE_URL)
    process.env.DATABASE_URL = resolveDatabaseUrl();

  const sqlitePath = getDatabasePath();
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const adapter = new PrismaLibSql({
    url: toLibsqlFileUrl(sqlitePath),
  });

  return { adapter, sqlitePath };
}

export function createSqlitePrismaClient(
  databaseUrl?: string,
): SqlitePrismaHandle {
  const { adapter, sqlitePath } = createSqliteAdapter(databaseUrl);
  return { prisma: new PrismaClient({ adapter }), sqlitePath };
}
