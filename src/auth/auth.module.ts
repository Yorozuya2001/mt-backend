import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PresenceService } from './presence.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_ACCESS_SECRET') ??
          configService.getOrThrow<string>('JWT_SECRET');
        const expiresIn = (configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          configService.get<string>('JWT_EXPIRES_IN') ??
          '15m') as StringValue;

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PresenceService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [
    AuthService,
    RefreshTokenService,
    PresenceService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}

export { Roles, JwtAuthGuard, RolesGuard };
