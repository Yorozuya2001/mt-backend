import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

describe('Inventory and stock (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let token: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    token = (await login(request, ctx.app)).token;

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Filtros' })
      .expect(201);
    categoryId = category.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates a product with decimal prices', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Filtro de aceite',
        price: 10.5,
        wholesalePrice: 8.25,
        stock: 10,
        minStock: 2,
        barcode: '779000000001',
        sku: 'FO-001',
      })
      .expect(201);

    productId = created.body.id;
    expect(created.body.price).toBe(10.5);
    expect(created.body.wholesalePrice).toBe(8.25);
    expect(created.body.stock).toBe(10);
  });

  it('rejects duplicate barcode', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Otro filtro',
        price: 1,
        barcode: '779000000001',
      })
      .expect(409);
  });

  it('finds product by barcode', async () => {
    const found = await request(app.getHttpServer())
      .get('/products/by-barcode/779000000001')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.id).toBe(productId);
  });

  it('finds product by SKU on the same endpoint', async () => {
    const found = await request(app.getHttpServer())
      .get('/products/by-barcode/FO-001')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(found.body.id).toBe(productId);
  });

  it('adjusts stock IN and OUT', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/stock/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'IN', quantity: 5, reason: 'compra' })
      .expect(201);

    const afterIn = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterIn.body.stock).toBe(15);

    await request(app.getHttpServer())
      .post(`/products/${productId}/stock/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'OUT', quantity: 3, reason: 'merma' })
      .expect(201);

    const afterOut = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterOut.body.stock).toBe(12);
  });

  it('rejects OUT that would go negative', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/stock/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'OUT', quantity: 999, reason: 'error' })
      .expect(400);
  });

  it('voids a non-sale movement and restores stock', async () => {
    const movements = await request(app.getHttpServer())
      .get(`/products/${productId}/stock/movements`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const inbound = movements.body.find((row: { type: string }) => row.type === 'IN');
    expect(inbound).toBeDefined();

    await request(app.getHttpServer())
      .post(`/stock/movements/${inbound.id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'anular ingreso' })
      .expect(201);

    const product = await request(app.getHttpServer())
      .get(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(product.body.stock).toBe(7);
  });
});
