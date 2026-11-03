import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  canActivate(context: ExecutionContext) {
    const now = Date.now();
    for (const [key, value] of this.attempts) {
      if (value.expiresAt <= now) this.attempts.delete(key);
    }
    const request = context.switchToHttp().getRequest<Request>();
    const username =
      typeof request.body?.username === 'string'
        ? request.body.username.trim().toLowerCase().slice(0, 50)
        : '';
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const addressKey = `ip:${address}`;
    const addressEntry = this.attempts.get(addressKey) ?? {
      count: 0,
      expiresAt: now + 15 * 60 * 1000,
    };
    if (addressEntry.count >= 100)
      throw new HttpException(
        '请求过于频繁，请 15 分钟后重试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    addressEntry.count += 1;
    this.attempts.set(addressKey, addressEntry);
    const key = `account:${address}:${username}`;
    const entry = this.attempts.get(key) ?? {
      count: 0,
      expiresAt: now + 15 * 60 * 1000,
    };
    if (entry.count >= 20 || this.attempts.size >= 10000) {
      throw new HttpException(
        '登录或注册过于频繁，请 15 分钟后重试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    entry.count += 1;
    this.attempts.set(key, entry);
    return true;
  }
}
