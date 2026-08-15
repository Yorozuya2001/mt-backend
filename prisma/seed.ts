import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { seedStaffUsers } from './seeds/staff.seed';

const DEMO_CLIENT_EMAIL_PREFIX = 'cliente.seed.';

const connectionString = process.env.DATABASE_URL;

if (!connectionString)
  throw new Error('DATABASE_URL no está definida en el entorno');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function removeDemoClients(client: PrismaClient): Promise<void> {
  const deleted = await client.user.deleteMany({
    where: { email: { startsWith: DEMO_CLIENT_EMAIL_PREFIX } },
  });

  if (deleted.count > 0)
    console.log(`Clientes de semilla eliminados: ${deleted.count}`);
}

async function main() {
  await removeDemoClients(prisma);
  await seedStaffUsers(prisma);
}

main()
  .catch((error) => {
    console.error('Seed falló:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
