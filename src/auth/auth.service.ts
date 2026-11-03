import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

const SESSION_COOKIE = 'luo_session';
const SESSION_DAYS = 7;

interface AuthInput {
  username?: unknown;
  password?: unknown;
  displayName?: unknown;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: AuthInput) {
    const username = this.normalizeUsername(input.username);
    const password = this.validatePassword(input.password);
    const displayName = this.normalizeDisplayName(input.displayName, username);
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException('用户名已存在');
    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          displayName,
        },
      });
      return this.toPublicUser(user, [], []);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('用户名已存在');
      throw error;
    }
  }

  async login(usernameInput: unknown, passwordInput: unknown) {
    const username =
      typeof usernameInput === 'string'
        ? usernameInput.trim().toLowerCase()
        : '';
    const password =
      typeof passwordInput === 'string' && passwordInput.length <= 128
        ? passwordInput
        : '';
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        menus: { include: { menu: { select: { permissionKey: true } } } },
      },
    });
    const validPassword = await verifyPassword(
      password,
      user?.passwordHash ??
        `scrypt$00000000000000000000000000000000$${'00'.repeat(64)}`,
    );
    if (!user || user.status !== 'active' || !validPassword) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const token = await this.createSession(user.id);
    return {
      user: this.toPublicUser(
        user,
        this.menuKeys(user.menus),
        user.menus.map((grant) => grant.menuId),
      ),
      token,
    };
  }

  async getUserByToken(token: string): Promise<AuthUser | undefined> {
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            menus: { include: { menu: { select: { permissionKey: true } } } },
          },
        },
      },
    });
    if (!session) return undefined;
    if (session.expiresAt <= new Date() || session.user.status !== 'active') {
      await this.prisma.session
        .delete({ where: { id: session.id } })
        .catch(() => undefined);
      return undefined;
    }
    return this.toPublicUser(
      session.user,
      this.menuKeys(session.user.menus),
      session.user.menus.map((grant) => grant.menuId),
    );
  }

  async logout(token?: string) {
    if (token)
      await this.prisma.session.deleteMany({
        where: { tokenHash: this.hashToken(token) },
      });
  }

  async deleteUser(id: number, currentUserId: number) {
    if (id === currentUserId)
      throw new ConflictException('不能删除当前登录用户');
    await this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id },
          select: { id: true, isAdmin: true },
        });
        if (!user) throw new NotFoundException('用户不存在');
        if (
          user.isAdmin &&
          (await transaction.user.count({
            where: { isAdmin: true, status: 'active' },
          })) <= 1
        ) {
          throw new ConflictException('不能删除最后一个管理员');
        }
        await transaction.user.delete({ where: { id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { deleted: true };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        status: true,
        isAdmin: true,
        createdAt: true,
      },
    });
    return users;
  }

  serializeSessionCookie(token: string) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; SameSite=Lax${secure}`;
  }

  serializeExpiredCookie() {
    return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
  }

  getSessionCookieName() {
    return SESSION_COOKIE;
  }

  private async createSession(userId: number) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.session.create({
      data: { tokenHash: this.hashToken(token), userId, expiresAt },
    });
    return token;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private menuKeys(menus: Array<{ menu: { permissionKey: string | null } }>) {
    return menus
      .map(({ menu }) => menu.permissionKey)
      .filter((key): key is string => Boolean(key));
  }

  private toPublicUser(
    user: {
      id: number;
      username: string;
      displayName: string;
      status: string;
      isAdmin: boolean;
    },
    menuKeys: string[],
    menuIds: number[],
  ): AuthUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      status: user.status,
      isAdmin: user.isAdmin,
      menuKeys,
      menuIds,
    };
  }

  private normalizeUsername(input: unknown) {
    if (typeof input !== 'string')
      throw new BadRequestException(
        '用户名须为 3–50 位字母、数字、下划线、点或短横线',
      );
    const username = input.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]{2,49}$/.test(username))
      throw new BadRequestException(
        '用户名须为 3–50 位字母、数字、下划线、点或短横线',
      );
    return username;
  }

  private validatePassword(input: unknown) {
    if (typeof input !== 'string' || input.length < 10 || input.length > 128) {
      throw new BadRequestException('密码长度必须为 10–128 个字符');
    }
    return input;
  }

  private normalizeDisplayName(input: unknown, fallback: string) {
    if (typeof input !== 'string' || !input.trim()) return fallback;
    if (input.trim().length > 80)
      throw new BadRequestException('昵称不能超过 80 个字符');
    return input.trim();
  }
}
