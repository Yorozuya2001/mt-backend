import {
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { getDataDir } from '../data-dir';
import { PrismaClient } from '../generated/prisma/client';
import {
  assertSqliteBackupStructure,
  quoteSqliteIdent,
} from '../system/sqlite-backup.util';
import { seedDesktopUsers } from './desktop-users.seed';
import { createSqliteAdapter } from './sqlite.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString =
      configService.get<string>('DATABASE_URL') ?? process.env.DATABASE_URL;
    const { adapter } = createSqliteAdapter(connectionString);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.applyPragmas();
    await this.applyPendingMigrations();
    if (process.env.SEED_DESKTOP === '1' || process.env.SEED_DESKTOP === 'true')
      await seedDesktopUsers(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async backupTo(destinationPath: string): Promise<void> {
    mkdirSync(dirname(destinationPath), { recursive: true });
    const dest = destinationPath.replace(/\\/g, '/').replace(/'/g, "''");
    await this.$executeRawUnsafe(`VACUUM INTO '${dest}'`);
  }

  async restoreFromFile(sourcePath: string): Promise<void> {
    await assertSqliteBackupStructure(sourcePath);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safetyPath = join(
      getDataDir(),
      'backups',
      `pre-restore-${stamp}.sqlite`,
    );
    await this.backupTo(safetyPath);

    const source = sourcePath.replace(/\\/g, '/').replace(/'/g, "''");
    await this.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    await this.$executeRawUnsafe(`ATTACH '${source}' AS incoming`);

    try {
      const mainTables = await this.listUserTables('main');
      const incomingTables = await this.listUserTables('incoming');
      const incomingSet = new Set(incomingTables);
      const tablesToClear = [...new Set([...mainTables, ...incomingTables])];
      const tablesToCopy = mainTables.filter((name) => incomingSet.has(name));

      for (const name of tablesToClear)
        await this.$executeRawUnsafe(
          `DELETE FROM main.${quoteSqliteIdent(name)}`,
        );

      for (const name of tablesToCopy) {
        const ident = quoteSqliteIdent(name);
        await this.$executeRawUnsafe(
          `INSERT INTO main.${ident} SELECT * FROM incoming.${ident}`,
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `No se pudo importar el respaldo. ${detail}`,
      );
    } finally {
      await this.$executeRawUnsafe('DETACH DATABASE incoming').catch(
        () => undefined,
      );
      await this.applyPragmas();
    }
  }

  private async listUserTables(schema: string): Promise<string[]> {
    const ident = quoteSqliteIdent(schema);
    const rows = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM ${ident}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    );
    return rows.map((row) => row.name);
  }

  private async applyPragmas() {
    await this.$executeRawUnsafe('PRAGMA journal_mode=WAL');
    await this.$executeRawUnsafe('PRAGMA busy_timeout=5000');
    await this.$executeRawUnsafe('PRAGMA foreign_keys=ON');
    await this.$executeRawUnsafe('PRAGMA synchronous=NORMAL');
  }

  private async applyPendingMigrations() {
    const tables = await this.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='User'`,
    );
    if (tables.length > 0) return;

    const migrationsDir = resolveMigrationsDir();
    if (!migrationsDir) return;

    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of folders) {
      const sqlPath = join(migrationsDir, folder, 'migration.sql');
      if (!existsSync(sqlPath)) continue;
      await this.executeSqlScript(readFileSync(sqlPath, 'utf8'));
    }
  }

  private async executeSqlScript(script: string) {
    const statements = script
      .split(';')
      .map((statement) =>
        statement
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((statement) => statement.length > 0);

    for (const statement of statements)
      await this.$executeRawUnsafe(statement);
  }
}

function resolveMigrationsDir(): string | null {
  const candidates = [
    process.env.PRISMA_MIGRATIONS_PATH,
    join(process.cwd(), 'prisma', 'migrations'),
    join(__dirname, '..', '..', 'prisma', 'migrations'),
    join(__dirname, '..', '..', '..', 'prisma', 'migrations'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
