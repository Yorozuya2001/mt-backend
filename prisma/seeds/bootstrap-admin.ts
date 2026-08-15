import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '../../src/generated/prisma/client';

export async function bootstrapAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'Bootstrap admin omitido: defina BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD',
    );
    return;
  }

  const existingSuperadmin = await prisma.user.findFirst({
    where: { role: Role.SUPERADMIN },
  });

  if (existingSuperadmin) {
    console.log('Bootstrap admin omitido: ya existe un SUPERADMIN');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      name: 'Super',
      lastName: 'Admin',
      role: Role.SUPERADMIN,
      isEmailVerified: true,
    },
  });

  console.log(`Bootstrap admin creado: ${email}`);
}
