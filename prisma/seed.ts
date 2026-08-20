import 'dotenv/config';
import { bootstrapAdmin } from './seeds/bootstrap-admin';
import { seedDesktopUsers } from './seeds/desktop-users.seed';
import { removeDemoClients, seedDevStaff } from './seeds/staff.seed';
import { createSqlitePrismaClient } from '../src/prisma/sqlite.util';

const { prisma } = createSqlitePrismaClient();

async function main() {
  const bootstrapOnly =
    process.env.SEED_BOOTSTRAP_ONLY === '1' ||
    process.env.SEED_BOOTSTRAP_ONLY === 'true';
  const seedDesktop =
    process.env.SEED_DESKTOP === '1' || process.env.SEED_DESKTOP === 'true';

  if (bootstrapOnly) {
    await bootstrapAdmin(prisma);
    return;
  }

  if (seedDesktop) {
    await seedDesktopUsers(prisma);
    return;
  }

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
