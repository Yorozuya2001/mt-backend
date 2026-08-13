import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RemitosModule } from './remitos/remitos.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    InventoryModule,
    RemitosModule,
    ReportsModule,
    MailModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
