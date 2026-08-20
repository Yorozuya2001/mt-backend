import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { servesFrontendInProduction } from './frontend-dist.util';
import { getLanIp } from './system.utils';

export type SystemMode = 'production' | 'development';

export type SystemInfo = {
  shopName: string;
  lanIp: string | null;
  frontendUrl: string;
  apiUrl: string;
  shareUrl: string | null;
  localUrl: string;
  port: number;
  devFrontendPort: number;
  servesFrontend: boolean;
  mode: SystemMode;
  appVersion: string;
  desktop: boolean;
};

const DEV_FRONTEND_PORT = 5173;

@Injectable()
export class SystemService {
  constructor(private readonly configService: ConfigService) {}

  getInfo(): SystemInfo {
    const port = Number(this.configService.get<string>('PORT') ?? 3000);
    const lanIp = getLanIp();
    const localUrl = `http://localhost:${port}`;
    const servesFrontend = servesFrontendInProduction();
    const desktop = this.configService.get<string>('MT_DESKTOP') === '1';
    const mode: SystemMode =
      servesFrontend || desktop ? 'production' : 'development';
    const lanApiUrl = lanIp ? `http://${lanIp}:${port}` : localUrl;
    const shareUrl = servesFrontend || desktop
      ? lanApiUrl
      : lanIp
        ? `http://${lanIp}:${DEV_FRONTEND_PORT}`
        : null;

    return {
      shopName: 'MT SHOP',
      lanIp,
      frontendUrl: shareUrl ?? lanApiUrl,
      apiUrl: lanApiUrl,
      shareUrl,
      localUrl,
      port,
      devFrontendPort: DEV_FRONTEND_PORT,
      servesFrontend: servesFrontend || desktop,
      mode,
      appVersion:
        this.configService.get<string>('APP_VERSION') ??
        process.env.npm_package_version ??
        '0.1.0',
      desktop,
    };
  }
}
