import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedClients } from './seeds/clients.seed';

const connectionString = process.env.DATABASE_URL;

if (!connectionString)
  throw new Error('DATABASE_URL no está definida en el entorno');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await seedClients(prisma);
}

main()
  .catch((error) => {
    console.error('Seed falló:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
