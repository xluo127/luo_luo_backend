import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
