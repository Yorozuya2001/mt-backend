import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

describe('Reports and concurrency (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let token: string;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    token = (await login(request, ctx.app)).token;

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lubricantes' })
      .expect(201);
    categoryId = category.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('keeps decimal totals exact in the daily report', async () => {
    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Aceite 10w40',
        price: 10.1,
        stock: 10,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/remitos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'EFECTIVO',
        items: [{ productId: product.body.id, quantity: 2 }],
      })
      .expect(201);

    const today = new Date().toISOString().slice(0, 10);
    const report = await request(app.getHttpServer())
      .get('/reports/daily')
      .query({ date: today })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(report.body.sales.totalAmount).toBe(20.2);
    expect(report.body.sales.totalCount).toBe(1);
  });

  it('serializes concurrent sales against the same stock', async () => {
    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Unidad unica',
        price: 50,
        stock: 3,
        barcode: '779000000099',
      })
      .expect(201);

    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .post('/remitos')
          .set('Authorization', `Bearer ${token}`)
          .send({
            paymentMethod: 'EFECTIVO',
            items: [{ productId: product.body.id, quantity: 1 }],
          }),
      ),
    );

    const succeeded = attempts.filter(
      (result) => result.status === 'fulfilled' && result.value.status === 201,
    ).length;
    const failed = attempts.length - succeeded;

    expect(succeeded).toBe(3);
    expect(failed).toBe(3);

    const updated = await request(app.getHttpServer())
      .get(`/products/${product.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(updated.body.stock).toBe(0);
  });
});
