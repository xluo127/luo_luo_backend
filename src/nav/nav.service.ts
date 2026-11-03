import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { authorizedMenuTree } from './menu-policy.js';

@Injectable()
export class NavService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const existing = await this.prisma.navNode.findMany();
    if (existing.length) {
      for (const menu of existing) {
        if (menu.permissionKey) continue;
        await this.prisma.navNode.update({
          where: { id: menu.id },
          data: { permissionKey: `menu.${menu.id}` },
        });
      }
      return;
    }
    await this.prisma.navNode.create({
      data: {
        title: '个人学习记录',
        url: '/learning',
        permissionKey: 'learning',
        sortOrder: 0,
        children: {
          create: [
            {
              title: '前端学习',
              url: '/learning?category=frontend',
              permissionKey: 'learning.frontend',
              children: {
                create: [
                  {
                    title: 'JavaScript',
                    url: '/learning?category=javascript',
                    permissionKey: 'learning.javascript',
                    sortOrder: 0,
                  },
                  {
                    title: 'CSS',
                    url: '/learning?category=css',
                    permissionKey: 'learning.css',
                    sortOrder: 1,
                  },
                  {
                    title: 'Vue',
                    url: '/learning?category=vue',
                    permissionKey: 'learning.vue',
                    sortOrder: 2,
                  },
                ],
              },
            },
            {
              title: '后端学习',
              url: '/learning?category=backend',
              permissionKey: 'learning.backend',
              sortOrder: 1,
              children: {
                create: [
                  {
                    title: 'Node.js',
                    url: '/learning?category=nodejs',
                    permissionKey: 'learning.nodejs',
                  },
                  {
                    title: 'NestJS',
                    url: '/learning?category=nestjs',
                    permissionKey: 'learning.nestjs',
                    sortOrder: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    });
    await this.prisma.navNode.create({
      data: {
        title: '实用工具',
        permissionKey: 'tools',
        sortOrder: 1,
        children: {
          create: [
            {
              title: 'GitHub',
              url: 'https://github.com',
              permissionKey: 'tools.github',
            },
            {
              title: 'JSON 格式化',
              url: 'https://jsonformatter.org',
              permissionKey: 'tools.json',
              sortOrder: 1,
            },
          ],
        },
      },
    });
  }

  async findAll(user: AuthUser) {
    const menus = await this.prisma.navNode.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return authorizedMenuTree(menus, user.menuIds, user.isAdmin);
  }
}
