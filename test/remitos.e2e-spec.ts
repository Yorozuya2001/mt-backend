import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TEST_SUPERADMIN,
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

describe('Remitos (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let token: string;
  let productId: string;
  let wholesaleClientId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    token = (await login(request, ctx.app)).token;

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Repuestos' })
      .expect(201);

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: category.body.id,
        title: 'Bujia',
        price: 10,
        wholesalePrice: 8,
        stock: 20,
        barcode: '779000000010',
      })
      .expect(201);
    productId = product.body.id;

    const superToken = (await login(request, ctx.app, TEST_SUPERADMIN.email))
      .token;
    const client = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        email: 'mayorista@test.local',
        name: 'Mayorista',
        lastName: 'Uno',
        role: 'CLIENT',
        isWholesale: true,
      })
      .expect(201);
    wholesaleClientId = client.body.user.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates a remito for final consumer and decrements stock', async () => {
    const remito = await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'EFECTIVO',
        items: [{ productId, quantity: 2 }],
      })
      .expect(201);

    expect(remito.body.number).toBe(1);
    expect(remito.body.total).toBe(20);
    expect(remito.body.items[0].unitPrice).toBe(10);

    const product = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(product.body.stock).toBe(18);
  });

  it('uses wholesale price for wholesale clients', async () => {
    const remito = await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: wholesaleClientId,
        paymentMethod: 'TRANSFERENCIA',
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);

    expect(remito.body.number).toBe(2);
    expect(remito.body.total).toBe(8);
    expect(remito.body.items[0].unitPrice).toBe(8);
  });

  it('autoincrements remito numbers', async () => {
    const remito = await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'TARJETA',
        items: [{ productId, quantity: 1 }],
      })
      .expect(201);
    expect(remito.body.number).toBe(3);
  });

  it('returns items partially and restocks', async () => {
    const remito = await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'EFECTIVO',
        items: [{ productId, quantity: 4 }],
      })
      .expect(201);

    const itemId = remito.body.items[0].id as string;
    const stockBefore = (
      await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.stock as number;

    await request(app.getHttpServer())
      .post(`/remitos/${remito.body.id}/returns`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ remitoItemId: itemId, quantity: 1 }],
        reason: 'defecto',
      })
      .expect(201);

    const product = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(product.body.stock).toBe(stockBefore + 1);
  });

  it('voids a remito and restores remaining stock', async () => {
    const remito = await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'EFECTIVO',
        items: [{ productId, quantity: 2 }],
      })
      .expect(201);

    const stockBefore = (
      await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body.stock as number;

    await request(app.getHttpServer())
      .post(`/remitos/${remito.body.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'error de carga' })
      .expect(201);

    const product = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(product.body.stock).toBe(stockBefore + 2);

    const voided = await request(app.getHttpServer())
      .get(`/remitos/${remito.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(voided.body.voidedAt).toBeTruthy();
  });
});
