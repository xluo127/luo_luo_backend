import { Controller, Get } from '@nestjs/common';
import { NavService } from './nav.service.js';

@Controller('nav')
export class NavController {
  constructor(private readonly navService: NavService) {}

  // GET 请求 http://localhost:3000/nav
  @Get()
  findAll() {
    return this.navService.findAll();
  }
}