import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMenus() {
    const menus = await this.prisma.navNode.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const nodes = new Map(
      menus.map((menu) => [menu.id, { ...menu, children: [] as unknown[] }]),
    );
    const roots: unknown[] = [];
    for (const node of nodes.values()) {
      if (node.parentId === null) roots.push(node);
      else
        (nodes.get(node.parentId)?.children as unknown[] | undefined)?.push(
          node,
        );
    }
    return { items: roots, flat: menus };
  }

  async createMenu(input: unknown) {
    const data = this.parseMenu(input);
    if (data.parentId !== null) await this.assertMenu(data.parentId);
    try {
      return await this.prisma.navNode.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('权限标识已存在');
      throw error;
    }
  }

  async updateMenu(id: number, input: unknown) {
    await this.assertMenu(id);
    const data = this.parseMenu(input);
    if (data.parentId !== null) {
      await this.assertMenu(data.parentId);
    }
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const menus = await transaction.navNode.findMany({
            select: { id: true, parentId: true },
          });
          const parents = new Map(
            menus.map((menu) => [menu.id, menu.parentId]),
          );
          const visited = new Set<number>([id]);
          let ancestor = data.parentId;
          while (ancestor !== null) {
            if (visited.has(ancestor))
              throw new BadRequestException('菜单不能移动到自身或其子菜单下');
            visited.add(ancestor);
            ancestor = parents.get(ancestor) ?? null;
          }
          return transaction.navNode.update({ where: { id }, data });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('权限标识已存在');
      throw error;
    }
  }

  async deleteMenu(id: number) {
    await this.assertMenu(id);
    const children = await this.prisma.navNode.count({
      where: { parentId: id },
    });
    if (children) throw new ConflictException('请先删除或移动子菜单');
    await this.prisma.navNode.delete({ where: { id } });
    return { deleted: true };
  }

  async getUserMenus(userId: number) {
    await this.assertUser(userId);
    const menus = await this.prisma.userMenu.findMany({
      where: { userId },
      select: { menuId: true },
    });
    return { menuIds: menus.map((menu) => menu.menuId) };
  }

  async setUserMenus(userId: number, input: unknown) {
    await this.assertUser(userId);
    const body = this.objectInput(input);
    if (
      !Array.isArray(body.menuIds) ||
      body.menuIds.length > 2000 ||
      body.menuIds.some((id) => !Number.isSafeInteger(id) || id < 1)
    ) {
      throw new BadRequestException('menuIds 必须是正整数数组');
    }
    const menuIds = [...new Set(body.menuIds as number[])];
    const menus = await this.prisma.navNode.findMany({
      where: { id: { in: menuIds } },
      select: { id: true, parentId: true },
    });
    if (menus.length !== menuIds.length)
      throw new BadRequestException('包含不存在的菜单');
    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.userMenu.deleteMany({ where: { userId } });
        if (menuIds.length)
          await transaction.userMenu.createMany({
            data: menuIds.map((menuId) => ({ userId, menuId })),
          });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { menuIds };
  }

  private parseMenu(input: unknown) {
    const body = this.objectInput(input);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const permissionKey =
      typeof body.permissionKey === 'string'
        ? body.permissionKey.trim().toLowerCase()
        : '';
    if (
      body.url !== null &&
      body.url !== undefined &&
      typeof body.url !== 'string'
    )
      throw new BadRequestException('菜单地址必须是字符串');
    const url = typeof body.url === 'string' ? body.url.trim() || null : null;
    const parentId = body.parentId ?? null;
    const sortOrder = body.sortOrder ?? 0;
    if (
      !title ||
      title.length > 100 ||
      !permissionKey ||
      !/^[a-z][a-z0-9._-]{1,99}$/.test(permissionKey)
    )
      throw new BadRequestException('菜单名称或权限标识无效');
    if (url !== null) {
      if (
        url.length > 500 ||
        url
          .split('')
          .some(
            (character) =>
              character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 92,
          )
      )
        throw new BadRequestException('菜单地址格式错误');
      if (
        !(url.startsWith('/') && !url.startsWith('//')) &&
        !/^https?:\/\//i.test(url)
      )
        throw new BadRequestException('菜单地址只允许站内路径或 HTTP(S) 链接');
      try {
        const parsed = new URL(url, 'http://internal.local');
        if (parsed.username || parsed.password) throw new Error();
      } catch {
        throw new BadRequestException('菜单地址格式错误');
      }
    }
    if (
      parentId !== null &&
      (typeof parentId !== 'number' ||
        !Number.isSafeInteger(parentId) ||
        parentId < 1)
    )
      throw new BadRequestException('父菜单 ID 无效');
    if (
      typeof sortOrder !== 'number' ||
      !Number.isSafeInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 2147483647
    )
      throw new BadRequestException('排序值无效');
    if (body.visible !== undefined && typeof body.visible !== 'boolean')
      throw new BadRequestException('显示状态必须是布尔值');
    return {
      title,
      permissionKey,
      url,
      parentId,
      sortOrder,
      visible: body.visible !== false,
    };
  }

  private objectInput(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('请求参数格式错误');
    return input as Record<string, unknown>;
  }

  private async assertMenu(id: number) {
    if (
      !(await this.prisma.navNode.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('菜单不存在');
  }

  private async assertUser(id: number) {
    if (
      !(await this.prisma.user.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('用户不存在');
  }
}
