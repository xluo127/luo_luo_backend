import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './auth.decorators.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';
import { objectInput } from '../learning/learning.validation.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('register')
  async register(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = objectInput(input);
    const user = await this.authService.register(body);
    response.setHeader(
      'Set-Cookie',
      this.authService.serializeSessionCookie(
        (await this.authService.login(user.username, body.password)).token,
      ),
    );
    return { user };
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  async login(
    @Body() input: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = objectInput(input);
    const result = await this.authService.login(body.username, body.password);
    response.setHeader(
      'Set-Cookie',
      this.authService.serializeSessionCookie(result.token),
    );
    return { user: result.user };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.sessionToken);
    response.setHeader('Set-Cookie', this.authService.serializeExpiredCookie());
    return { loggedOut: true };
  }
}
