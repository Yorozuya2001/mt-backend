import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { CategoriesService } from '../../src/inventory/categories.service';
import { CatalogCsvImporter } from '../../src/inventory/import/catalog-csv.importer';
import { PartsXlsxImporter } from '../../src/inventory/import/parts-xlsx.importer';

const DEFAULT_XLSX =
  '/home/axel/Downloads/LISTA INVENTARIO .xlsx';
const DEFAULT_CSV =
  '/home/axel/Downloads/TOXIC SHINE MATTHEW(PRECIOS SIN IVA).csv';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL no está definida en el entorno');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function seedInventory(prismaClient: PrismaClient) {
  const xlsxPath = process.env.INVENTORY_XLSX_PATH ?? DEFAULT_XLSX;
  const csvPath = process.env.CATALOG_CSV_PATH ?? DEFAULT_CSV;

  const categoriesService = new CategoriesService(prismaClient as never);
  const partsImporter = new PartsXlsxImporter(
    prismaClient as never,
    categoriesService,
  );
  const catalogImporter = new CatalogCsvImporter(
    prismaClient as never,
    categoriesService,
  );

  if (existsSync(xlsxPath)) {
    const buffer = readFileSync(xlsxPath);
    const partsResult = await partsImporter.import(buffer, 'merge');
    console.log(
      `Import repuestos: +${partsResult.created} nuevos, ${partsResult.updated} actualizados, ${partsResult.skipped} omitidos`,
    );
  } else {
    console.warn(`XLSX no encontrado: ${xlsxPath}`);
  }

  if (existsSync(csvPath)) {
    const buffer = readFileSync(csvPath);
    const catalogResult = await catalogImporter.import(buffer, 'merge');
    console.log(
      `Import detailing: +${catalogResult.created} nuevos, ${catalogResult.updated} actualizados, ${catalogResult.skipped} omitidos`,
    );
  } else {
    console.warn(`CSV no encontrado: ${csvPath}`);
  }

  const [products, categories] = await Promise.all([
    prismaClient.product.count(),
    prismaClient.category.count(),
  ]);
  console.log(`Inventario total: ${products} productos en ${categories} categorías`);
}

async function main() {
  await seedInventory(prisma);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Seed inventario falló:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
