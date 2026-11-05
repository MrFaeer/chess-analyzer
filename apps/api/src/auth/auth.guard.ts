import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AuthService, type AuthRequest } from './auth.service';
import { PUBLIC_ROUTE } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.headers.origin !== this.auth.origin || request.headers['x-csrf-protection'] !== '1' ||
        !request.is('application/json') || request.headers['sec-fetch-site'] === 'cross-site') {
        throw new ForbiddenException({ code: 'requestRejected' });
      }
    }
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const user = await this.auth.current(request);
    if (!user) throw new UnauthorizedException({ code: 'sessionExpired' });
    request.currentUser = user;
    return true;
  }
}
