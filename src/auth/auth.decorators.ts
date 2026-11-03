import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

export const IS_PUBLIC_KEY = 'auth:public';
export const IS_ADMIN_KEY = 'auth:admin';
export const REQUIRED_MENUS_KEY = 'auth:menus';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const AdminOnly = () => SetMetadata(IS_ADMIN_KEY, true);
export const RequireMenu = (...menuKeys: string[]) =>
  SetMetadata(REQUIRED_MENUS_KEY, menuKeys);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
