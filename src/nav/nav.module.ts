import { Module } from '@nestjs/common';
import { NavService } from './nav.service.js';
import { NavController } from './nav.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NavController],
  providers: [NavService],
})
export class NavModule {}
