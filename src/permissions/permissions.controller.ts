import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { AdminOnly } from '../auth/auth.decorators.js';
import { PermissionsService } from './permissions.service.js';

@AdminOnly()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('menus') listMenus() {
    return this.permissionsService.listMenus();
  }
  @Post('menus') createMenu(@Body() body: unknown) {
    return this.permissionsService.createMenu(body);
  }
  @Put('menus/:id') updateMenu(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.permissionsService.updateMenu(id, body);
  }
  @Delete('menus/:id') deleteMenu(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.deleteMenu(id);
  }
  @Get('users/:id/menus') getUserMenus(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.getUserMenus(id);
  }
  @Put('users/:id/menus') setUserMenus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.permissionsService.setUserMenus(id, body);
  }
}
