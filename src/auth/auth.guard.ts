import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import {
  IS_ADMIN_KEY,
  IS_PUBLIC_KEY,
  REQUIRED_MENUS_KEY,
} from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { LearningAccessService } from './learning-access.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly learningAccess: LearningAccessService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    context.switchToHttp().getResponse().setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers['x-luo-request'] !== '1'
    ) {
      throw new ForbiddenException('请求缺少安全校验头');
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const token = this.readCookie(
      request.headers.cookie,
      this.authService.getSessionCookieName(),
    );
    const user = token
      ? await this.authService.getUserByToken(token)
      : undefined;
    if (!user) throw new UnauthorizedException('请先登录');
    request.user = user;
    request.sessionToken = token;

    const adminOnly = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (adminOnly && !user.isAdmin)
      throw new ForbiddenException('仅管理员可操作');
    const requiredMenus =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_MENUS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredMenus.includes('learning')) {
      await this.learningAccess.authorize(request, user);
      return true;
    }
    if (
      !user.isAdmin &&
      requiredMenus.length &&
      !requiredMenus.some((key) => user.menuKeys.includes(key))
    ) {
      throw new ForbiddenException('没有访问该功能的菜单权限');
    }
    return true;
  }

  private readCookie(header: string | undefined, name: string) {
    if (!header) return undefined;
    const item = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    try {
      const token = item
        ? decodeURIComponent(item.slice(name.length + 1))
        : undefined;
      return token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? token : undefined;
    } catch {
      return undefined;
    }
  }
}
