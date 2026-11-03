import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { AdminOnly } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';

@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  list() {
    return this.authService.listUsers();
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.deleteUser(id, request.user!.id);
  }
}
