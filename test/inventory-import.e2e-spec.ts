import { INestApplication } from '@nestjs/common';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { writePartsImportFixture } from './fixtures/build-parts-import-fixture';
import {
  createTestApp,
  login,
  type TestApp,
} from './helpers/create-test-app';

describe('Inventory import (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let token: string;
  let fixturePath: string;
  let fixtureBuffer: Buffer;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    token = (await login(request, ctx.app)).token;
    const fixtureDir = mkdtempSync(join(tmpdir(), 'mt-import-fixture-'));
    fixturePath = await writePartsImportFixture(fixtureDir);
    fixtureBuffer = readFileSync(fixturePath);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('imports parts xlsx with standard header, duplicate sku batch, and no-header sheet', async () => {
    const response = await request(app.getHttpServer())
      .post('/products/import/parts-xlsx')
      .set('Authorization', `Bearer ${token}`)
      .field('mode', 'merge')
      .attach('file', fixtureBuffer, 'parts-import-fixture.xlsx')
      .expect(201);

    expect(response.body.created + response.body.updated).toBeGreaterThanOrEqual(5);

    const products = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const titles = (products.body.items as Array<{ title: string }>).map(
      (product) => product.title,
    );

    expect(titles).toEqual(
      expect.arrayContaining([
        'BUJIA CPR8EA 9',
        'ABRAZADERA FILTRO AIRE',
        'AJUSTA RAYOS',
      ]),
    );

    const duplicateSku = await ctx.prisma.product.findUnique({
      where: { sku: '01MO1620' },
    });
    expect(duplicateSku?.title).toBe('Junta culata B');
  });
});
