import type { PrismaService } from '../prisma/prisma.service.js';
import { LearningAccessService } from './learning-access.service.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

describe('LearningAccessService', () => {
  const menus = [
    { id: 1, parentId: null, visible: true, url: '/learning' },
    { id: 2, parentId: 1, visible: true, url: '/learning?category=javascript' },
  ];
  const categories = [
    { id: 1, slug: 'frontend', parentId: null },
    { id: 2, slug: 'javascript', parentId: 1 },
    { id: 3, slug: 'css', parentId: 1 },
    { id: 4, slug: 'javascript-child', parentId: 2 },
  ];
  const user: AuthUser = {
    id: 1,
    username: 'learner',
    displayName: 'Learner',
    status: 'active',
    isAdmin: false,
    menuIds: [2],
    menuKeys: [],
  };
  const prisma = {
    navNode: { findMany: vi.fn() },
    learningCategory: { findMany: vi.fn() },
    knowledgePoint: { findUnique: vi.fn() },
  };
  const service = new LearningAccessService(prisma as unknown as PrismaService);
  const request = (
    method = 'GET',
    path = '/learning/overview',
    id?: string,
    body?: unknown,
  ) =>
    ({ method, path, params: { id }, body }) as unknown as AuthenticatedRequest;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.navNode.findMany.mockResolvedValue(menus);
    prisma.learningCategory.findMany.mockResolvedValue(categories);
  });
  it('limits access to the assigned category and descendants', async () => {
    const input = request();
    await service.authorize(input, user);
    expect(input.learningCategoryIds?.sort()).toEqual([2, 4]);
  });
  it('rejects users without learning grants', async () => {
    await expect(
      service.authorize(request(), { ...user, menuIds: [] }),
    ).rejects.toThrow('没有学习记录');
  });
  it('rejects direct reads and writes to unassigned points', async () => {
    prisma.knowledgePoint.findUnique.mockResolvedValue({ categoryId: 3 });
    await expect(
      service.authorize(request('GET', '/learning/points/9', '9'), user),
    ).rejects.toThrow('所属分类');
    await expect(
      service.authorize(request('PUT', '/learning/points/9/note', '9'), user),
    ).rejects.toThrow('所属分类');
  });
  it('rejects moves and new points into unassigned categories', async () => {
    await expect(
      service.authorize(
        request('POST', '/learning/points', undefined, { categoryId: 3 }),
        user,
      ),
    ).rejects.toThrow('目标学习分类');
  });
  it('revokes access when a menu ancestor is hidden', async () => {
    prisma.navNode.findMany.mockResolvedValue([
      { ...menus[0], visible: false },
      menus[1],
    ]);
    await expect(service.authorize(request(), user)).rejects.toThrow(
      '没有学习记录',
    );
  });
  it('lets administrators access every category', async () => {
    await service.authorize(request(), { ...user, isAdmin: true });
    expect(prisma.navNode.findMany).not.toHaveBeenCalled();
  });
});
