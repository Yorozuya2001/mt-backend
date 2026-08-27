import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { createUploadsAuthMiddleware } from './auth/uploads-auth.middleware';
import { getUploadsDir } from './data-dir';
import { resolveFrontendDist } from './system/frontend-dist.util';
import { isLanHttpOrigin } from './system/system.utils';

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
  const configService = app.get(ConfigService);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          'upgrade-insecure-requests': null,
        },
      },
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      strictTransportSecurity: false,
    }),
  );
  app.use(cookieParser());

  const configuredOrigins = configService
    .get<string>('CORS_ORIGIN')
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? [
    'http://localhost',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1',
    'http://127.0.0.1:5173',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin) || isLanHttpOrigin(origin))
        return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });

  const jwtSecret =
    configService.get<string>('JWT_ACCESS_SECRET') ??
    configService.getOrThrow<string>('JWT_SECRET');
  const jwtService = app.get(JwtService);
  const uploadsAuth = createUploadsAuthMiddleware(jwtService, jwtSecret);

  app.use('/uploads', uploadsAuth);
  app.useStaticAssets(getUploadsDir(), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const host = configService.get<string>('HOST') ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? configService.get<string>('PORT') ?? 3000);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const frontendDist = isProduction ? resolveFrontendDist() : null;

  if (frontendDist) {
    app.useStaticAssets(frontendDist, { index: false });

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (isApiRoute(req.path)) return next();
      if (req.path.includes('.')) return next();

      res.sendFile(resolve(frontendDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  await app.listen(port, host);

  console.log(`MT API listening on http://${host}:${port}`);
  if (frontendDist) console.log(`Serving frontend from ${frontendDist}`);
}
bootstrap().catch((error) => {
  console.error('Failed to start MT API:', error);
  process.exit(1);
});
