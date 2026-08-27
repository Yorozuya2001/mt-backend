import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '../../src/generated/prisma/client';

const DEMO_CLIENT_EMAIL_PREFIX = 'cliente.seed.';

export async function removeDemoClients(prisma: PrismaClient): Promise<void> {
  const deleted = await prisma.user.deleteMany({
    where: { email: { startsWith: DEMO_CLIENT_EMAIL_PREFIX } },
  });

  if (deleted.count > 0)
    console.log(`Clientes de semilla eliminados: ${deleted.count}`);
}

/**
 * Crea admins de desarrollo solo si STAFF_DEV_PASSWORD está definida.
 * Nunca commitear passwords en este archivo.
 */
export async function seedDevStaff(prisma: PrismaClient): Promise<void> {
  const devPassword = process.env.STAFF_DEV_PASSWORD;
  if (!devPassword) {
    console.log('Seed staff omitido: defina STAFF_DEV_PASSWORD para desarrollo');
    return;
  }

  const staff = [
    {
      email: 'admin1@shop.com',
      name: 'Admin',
      lastName: 'Uno',
      role: Role.ADMIN,
    },
    {
      email: 'admin2@shop.com',
      name: 'Admin',
      lastName: 'Dos',
      role: Role.ADMIN,
    },
  ];

  const passwordHash = await bcrypt.hash(devPassword, 10);

  for (const entry of staff) {
    await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        password: passwordHash,
        name: entry.name,
        lastName: entry.lastName,
        role: entry.role,
        isEmailVerified: true,
      },
      create: {
        email: entry.email,
        password: passwordHash,
        name: entry.name,
        lastName: entry.lastName,
        role: entry.role,
        isEmailVerified: true,
      },
    });

    console.log(`Seed staff: ${entry.email} (${entry.role})`);
  }
}
