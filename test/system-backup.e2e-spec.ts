import { INestApplication } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import {
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

function collectBinary(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('System backup and restore (e2e)', () => {
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
      .send({ name: 'Respaldos' })
      .expect(201);
    categoryId = category.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('downloads a sqlite backup', async () => {
    const response = await request(app.getHttpServer())
      .get('/system/backup')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(collectBinary)
      .expect(200);

    const body = response.body as Buffer;
    expect(body.subarray(0, 15).toString('utf8')).toBe('SQLite format 3');
    expect(response.headers['content-disposition']).toMatch(/mt-shop-.*\.sqlite/);
  });

  it('rejects an invalid sqlite restore without changing data', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Producto a conservar',
        price: 10,
        stock: 4,
      })
      .expect(201);

    const junkPath = join(ctx.dataDir, 'junk.txt');
    writeFileSync(junkPath, 'not a database');

    await request(app.getHttpServer())
      .post('/system/restore')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', junkPath)
      .expect(400);

    const product = await request(app.getHttpServer())
      .get(`/products/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(product.body.title).toBe('Producto a conservar');
  });

  it('restores a previous backup and drops later products', async () => {
    const first = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Producto en backup',
        price: 12,
        stock: 5,
      })
      .expect(201);

    const backup = await request(app.getHttpServer())
      .get('/system/backup')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(collectBinary)
      .expect(200);

    const backupPath = join(ctx.dataDir, 'roundtrip.sqlite');
    writeFileSync(backupPath, backup.body);

    const second = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId,
        title: 'Producto posterior',
        price: 20,
        stock: 8,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/system/restore')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', backupPath)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/products/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/products/${second.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
