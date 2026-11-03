import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { LearningService } from './learning.service.js';
import { AdminOnly, RequireMenu } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

@RequireMenu('learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('overview')
  getOverview(@Req() request: AuthenticatedRequest, @Query('category') category?: string) {
    return this.learningService.getOverview(category, request.learningCategoryIds);
  }

  @Get('categories')
  getCategories(@Req() request: AuthenticatedRequest) {
    return this.learningService.getCategories(request.learningCategoryIds);
  }

  @Post('categories')
  @AdminOnly()
  createCategory(@Body() body: unknown) {
    return this.learningService.createCategory(body);
  }

  @Put('categories/:id')
  @AdminOnly()
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.learningService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @AdminOnly()
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.learningService.deleteCategory(id);
  }

  @Get('points')
  getPoints(@Req() request: AuthenticatedRequest, @Query('category') category?: string) {
    return this.learningService.getPoints(category, request.learningCategoryIds);
  }

  @Post('points')
  createPoint(@Body() body: unknown) {
    return this.learningService.createPoint(body);
  }

  @Get('points/:id')
  getPoint(@Param('id', ParseIntPipe) id: number) {
    return this.learningService.getPoint(id);
  }

  @Get('points/:id/editor')
  getPointForEditor(@Param('id', ParseIntPipe) id: number) {
    return this.learningService.getPointForEditor(id);
  }

  @Put('points/:id')
  updatePoint(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.learningService.updatePoint(id, body);
  }

  @Delete('points/:id')
  deletePoint(@Param('id', ParseIntPipe) id: number) {
    return this.learningService.deletePoint(id);
  }

  @Patch('points/:id/progress')
  updateProgress(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.learningService.updateProgress(id, body);
  }

  @Put('points/:id/note')
  saveNote(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.learningService.saveNote(id, body);
  }

  @Post('points/:id/quiz')
  submitQuiz(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.learningService.submitQuiz(id, body);
  }
}
