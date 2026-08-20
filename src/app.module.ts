import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemitosModule } from './remitos/remitos.module';
import { ReportsModule } from './reports/reports.module';
import { SystemModule } from './system/system.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit:
          process.env.NODE_ENV === 'test'
            ? 100000
            : Number(process.env.THROTTLE_LIMIT ?? 1000),
      },
    ]),
    PrismaModule,
    UsersModule,
    InventoryModule,
    RemitosModule,
    ReportsModule,
    SystemModule,
    MailModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
