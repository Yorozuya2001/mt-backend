import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

export const TEST_ADMIN = {
  email: 'admin@test.local',
  password: 'password1',
};

export const TEST_SUPERADMIN = {
  email: 'superadmin@test.local',
  password: 'password1',
};

export type TestApp = {
  app: NestExpressApplication;
  prisma: PrismaService;
  dataDir: string;
};

export async function createTestApp(): Promise<TestApp> {
  const dataDir = mkdtempSync(join(tmpdir(), 'mt-e2e-'));
  process.env.MT_DATA_DIR = dataDir;
  process.env.DATABASE_URL = `file:${join(dataDir, 'mt.sqlite').replace(/\\/g, '/')}`;
  process.env.MT_UPLOADS_DIR = join(dataDir, 'uploads');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const prisma = app.get(PrismaService);
  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 10);

  await prisma.user.create({
    data: {
      email: TEST_ADMIN.email,
      password: passwordHash,
      name: 'Admin',
      lastName: 'Test',
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      email: TEST_SUPERADMIN.email,
      password: passwordHash,
      name: 'Super',
      lastName: 'Admin',
      role: Role.SUPERADMIN,
      isEmailVerified: true,
    },
  });

  return { app, prisma, dataDir };
}

export async function login(
  request: typeof import('supertest'),
  app: NestExpressApplication,
  email = TEST_ADMIN.email,
  password = TEST_ADMIN.password,
) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  const token = response.body.access_token as string;
  const cookies = response.headers['set-cookie'] as string[] | string | undefined;
  const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies ?? '';

  return { token, cookieHeader };
}
