import { mkdirSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

export function getDataDir(): string {
  const fromEnv = process.env.MT_DATA_DIR?.trim();
  const dir = fromEnv ? fromEnv : join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sqlitePathFromUrl(databaseUrl: string): string {
  let raw = databaseUrl.trim();
  if (raw.startsWith('file:')) raw = raw.slice('file:'.length);
  raw = raw.replace(/^\/\/\//, '');
  raw = raw.replace(/^\/\/localhost\//i, '');

  if (isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) return raw;
  return resolve(process.cwd(), raw);
}

export function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  return `file:${join(getDataDir(), 'mt.sqlite').replace(/\\/g, '/')}`;
}

export function getDatabasePath(): string {
  return sqlitePathFromUrl(resolveDatabaseUrl());
}

export function getUploadsDir(): string {
  const fromEnv = process.env.MT_UPLOADS_DIR?.trim();
  if (fromEnv) {
    mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const dir = join(getDataDir(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getCredentialsPath(): string {
  return join(getDataDir(), 'credentials.json');
}
