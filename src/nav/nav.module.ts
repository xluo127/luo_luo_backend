import { Module } from '@nestjs/common';
import { NavService } from './nav.service.js';
import { NavController } from './nav.controller.js';

@Module({
  controllers: [NavController],
  providers: [NavService],
})
export class NavModule {}
