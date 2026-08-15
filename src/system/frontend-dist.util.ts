import { existsSync } from 'fs';
import { join, resolve } from 'path';

export function resolveFrontendDist(): string | null {
  const configuredPath = process.env.FRONTEND_DIST_PATH;
  const candidates = [
    configuredPath,
    join(process.cwd(), '..', 'mt-front', 'dist'),
    join(process.cwd(), 'mt-front', 'dist'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const absolutePath = resolve(candidate);
    if (existsSync(join(absolutePath, 'index.html'))) return absolutePath;
  }

  return null;
}

export function servesFrontendInProduction(): boolean {
  return process.env.NODE_ENV === 'production' && resolveFrontendDist() !== null;
}
