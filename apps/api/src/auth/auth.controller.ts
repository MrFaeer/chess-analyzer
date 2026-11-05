import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, type AuthRequest } from './auth.service';
import { preference } from './auth.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    this.auth.limit(`register:${request.ip}`, 10);
    return this.auth.register(body, request, response);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    this.auth.limit(`login:${request.ip}`, 20);
    return this.auth.login(body, request, response);
  }

  @Get('me')
  current(@Req() request: AuthRequest) { return request.currentUser!; }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    return this.auth.logout(request, response);
  }

  @Patch('preferences')
  language(@Body() body: unknown, @Req() request: AuthRequest) {
    return this.auth.language(request.currentUser!.id, preference(body));
  }
}
