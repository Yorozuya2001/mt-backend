import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { bootstrapAdmin } from './seeds/bootstrap-admin';
import { removeDemoClients, seedDevStaff } from './seeds/staff.seed';

const connectionString = process.env.DATABASE_URL;

if (!connectionString)
  throw new Error('DATABASE_URL no está definida en el entorno');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await removeDemoClients(prisma);
  await bootstrapAdmin(prisma);
  await seedDevStaff(prisma);
}

main()
  .catch((error) => {
    console.error('Seed falló:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
