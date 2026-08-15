import type { NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';

export function createUploadsAuthMiddleware(jwtService: JwtService, secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).end();
      return;
    }

    const token = authHeader.slice(7);

    try {
      jwtService.verify(token, { secret });
      next();
    } catch {
      res.status(401).end();
    }
  };
}
