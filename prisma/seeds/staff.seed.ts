import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '../../src/generated/prisma/client';

export const STAFF_USERS = [
  {
    email: 'superadmin@mt.local',
    password: 'SuperAdmin123!',
    name: 'Super',
    lastName: 'Admin',
    role: Role.SUPERADMIN,
  },
  {
    email: 'admin1@shop.com',
    password: 'Admin1Shop2026!',
    name: 'Admin',
    lastName: 'Uno',
    role: Role.ADMIN,
  },
  {
    email: 'admin2@shop.com',
    password: 'Admin2Shop2026!',
    name: 'Admin',
    lastName: 'Dos',
    role: Role.ADMIN,
  },
] as const;

export async function seedStaffUsers(prisma: PrismaClient): Promise<void> {
  for (const staff of STAFF_USERS) {
    const passwordHash = await bcrypt.hash(staff.password, 10);

    await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        password: passwordHash,
        name: staff.name,
        lastName: staff.lastName,
        role: staff.role,
        isEmailVerified: true,
        verificationToken: null,
      },
      create: {
        email: staff.email,
        password: passwordHash,
        name: staff.name,
        lastName: staff.lastName,
        role: staff.role,
        isEmailVerified: true,
      },
    });

    console.log(`Seed staff: ${staff.email} (${staff.role})`);
  }
}
