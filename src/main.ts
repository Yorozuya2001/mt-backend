import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { resolveFrontendDist } from './system/frontend-dist.util';

const API_ROUTE_PREFIXES = [
  '/auth',
  '/users',
  '/products',
  '/categories',
  '/remitos',
  '/stock',
  '/reports',
  '/health',
  '/system',
  '/uploads',
];

function isApiRoute(path: string): boolean {
  return API_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
    'http://localhost',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1',
    'http://127.0.0.1:5173',
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendDist = isProduction ? resolveFrontendDist() : null;

  if (frontendDist) {
    app.useStaticAssets(frontendDist, { index: false });
  }

  await app.listen(port, host);

  if (frontendDist) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('*', (req, res, next) => {
      if (req.method !== 'GET') return next();
      if (isApiRoute(req.path)) return next();
      if (req.path.includes('.')) return next();

      res.sendFile(join(frontendDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  console.log(`MT API listening on http://${host}:${port}`);
  if (frontendDist) console.log(`Serving frontend from ${frontendDist}`);
}
bootstrap();
