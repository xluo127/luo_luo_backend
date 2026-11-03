import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { NavService } from './nav.service.js';

@Controller('nav')
export class NavController {
  constructor(private readonly navService: NavService) {}

  // GET 请求 http://localhost:3000/nav
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.navService.findAll(user);
  }
}
