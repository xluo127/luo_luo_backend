import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { learningScope, visibleMenus } from '../nav/menu-policy.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

@Injectable()
export class LearningAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(request: AuthenticatedRequest, user: AuthUser) {
    if (user.isAdmin) return;
    const menus = visibleMenus(await this.prisma.navNode.findMany());
    const grants = new Set(user.menuIds);
    const scopes = menus
      .filter((menu) => grants.has(menu.id))
      .map((menu) => learningScope(menu.url))
      .filter((scope) => scope !== undefined);
    if (!scopes.length) throw new ForbiddenException('没有学习记录的菜单权限');
    const categories = await this.prisma.learningCategory.findMany({
      select: { id: true, slug: true, parentId: true },
    });
    const allowed = new Set<number>();
    const pending = categories
      .filter(
        (category) => scopes.includes(null) || scopes.includes(category.slug),
      )
      .map((category) => category.id);
    while (pending.length) {
      const categoryId = pending.pop()!;
      if (allowed.has(categoryId)) continue;
      allowed.add(categoryId);
      pending.push(
        ...categories
          .filter((category) => category.parentId === categoryId)
          .map((category) => category.id),
      );
    }
    if (!allowed.size) throw new ForbiddenException('没有可访问的学习分类');
    request.learningCategoryIds = [...allowed];
    const pointId = Number(request.params.id);
    if (Number.isSafeInteger(pointId) && request.path.includes('/points/')) {
      const point = await this.prisma.knowledgePoint.findUnique({
        where: { id: pointId },
        select: { categoryId: true },
      });
      if (!point) throw new NotFoundException('知识点不存在');
      if (!allowed.has(point.categoryId))
        throw new ForbiddenException('没有该知识点所属分类的权限');
    }
    if (
      ['POST', 'PUT'].includes(request.method) &&
      request.body &&
      Object.hasOwn(request.body, 'categoryId')
    ) {
      if (!allowed.has(request.body.categoryId))
        throw new ForbiddenException('没有目标学习分类的权限');
    }
  }
}
