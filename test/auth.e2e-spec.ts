import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Role } from '../src/generated/prisma/client';
import {
  TEST_ADMIN,
  TEST_SUPERADMIN,
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

describe('Auth (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health is public', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('logs in staff and returns a JWT', async () => {
    const { token } = await login(request, ctx.app);
    expect(token).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body.email).toBe(TEST_ADMIN.email);
    expect(me.body.role).toBe(Role.ADMIN);
  });

  it('rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'wrongpass' })
      .expect(401);
  });

  it('rejects CLIENT login', async () => {
    const token = (await login(request, ctx.app, TEST_SUPERADMIN.email)).token;

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'cliente@test.local',
        password: 'cliente1',
        name: 'Cliente',
        lastName: 'Uno',
        role: 'CLIENT',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cliente@test.local', password: 'cliente1' })
      .expect(403);
  });

  it('rotates refresh cookie', async () => {
    const { token, cookieHeader } = await login(request, ctx.app);
    expect(cookieHeader).toContain('mt_refresh');

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieHeader)
      .expect(201);

    expect(refreshed.body.access_token).toEqual(expect.any(String));
  });

  it('creates ADMIN already verified when SMTP is off', async () => {
    const { token } = await login(request, ctx.app, TEST_SUPERADMIN.email);

    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'caja3@test.local',
        password: 'caja1234',
        name: 'Caja',
        lastName: 'Tres',
        role: 'ADMIN',
      })
      .expect(201);

    expect(created.body.user.isEmailVerified).toBe(true);

    const { token: cajaToken } = await login(
      request,
      ctx.app,
      'caja3@test.local',
      'caja1234',
    );
    expect(cajaToken).toEqual(expect.any(String));
  });
});
