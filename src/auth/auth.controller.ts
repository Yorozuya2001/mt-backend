import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PresenceService } from './presence.service';
import type { AuthUser } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly presenceService: PresenceService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Throttle({
    default: { limit: process.env.NODE_ENV === 'test' ? 100000 : 5, ttl: 900000 },
  })
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 900000 } })
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(req, res);
  }

  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: AuthUser }) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me/password')
  changePassword(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: ChangeOwnPasswordDto,
  ) {
    return this.authService.changeOwnPassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('heartbeat')
  async heartbeat(@Req() req: Request & { user: AuthUser }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) return { ok: false };

    const displayName = `${user.name} ${user.lastName}`.trim() || user.email;
    this.presenceService.touch({
      userId: user.id,
      name: displayName,
      email: user.email,
      role: user.role,
    });
    return { ok: true };
  }

  @Delete('heartbeat')
  leave(@Req() req: Request & { user: AuthUser }) {
    this.presenceService.leave(req.user.id);
    return { ok: true };
  }
}
