import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '../generated/prisma/client';
import { getCredentialsPath } from '../data-dir';

export type DesktopCredential = {
  email: string;
  password: string;
  name: string;
  lastName: string;
  role: 'SUPERADMIN' | 'ADMIN';
};

const DESKTOP_USERS: Array<Omit<DesktopCredential, 'password'>> = [
  {
    email: 'superadmin@mtshop.local',
    name: 'Super',
    lastName: 'Admin',
    role: 'SUPERADMIN',
  },
  {
    email: 'caja1@mtshop.local',
    name: 'Caja',
    lastName: 'Uno',
    role: 'ADMIN',
  },
  {
    email: 'caja2@mtshop.local',
    name: 'Caja',
    lastName: 'Dos',
    role: 'ADMIN',
  },
];

function randomPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

export async function seedDesktopUsers(
  prisma: PrismaClient,
): Promise<DesktopCredential[] | null> {
  const existingSuperadmin = await prisma.user.findFirst({
    where: { role: Role.SUPERADMIN },
  });

  if (existingSuperadmin) {
    console.log('Seed escritorio omitido: ya existe un SUPERADMIN');
    return null;
  }

  const credentials: DesktopCredential[] = [];

  for (const entry of DESKTOP_USERS) {
    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email: entry.email,
        password: passwordHash,
        name: entry.name,
        lastName: entry.lastName,
        role: entry.role === 'SUPERADMIN' ? Role.SUPERADMIN : Role.ADMIN,
        isEmailVerified: true,
      },
    });

    credentials.push({ ...entry, password });
    console.log(`Seed escritorio: ${entry.email} (${entry.role})`);
  }

  writeFileSync(
    getCredentialsPath(),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), users: credentials },
      null,
      2,
    ),
    'utf8',
  );

  return credentials;
}
