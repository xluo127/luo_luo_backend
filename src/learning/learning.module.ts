import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LearningSeedService } from './learning.seed.js';

@Module({
  imports: [PrismaModule],
  controllers: [LearningController],
  providers: [LearningService, LearningSeedService],
})
export class LearningModule {}
