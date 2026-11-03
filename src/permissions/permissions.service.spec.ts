import type { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from './permissions.service.js';

describe('PermissionsService', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    navNode: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userMenu: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new PermissionsService(prisma as unknown as PrismaService);
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 10 });
    prisma.navNode.findUnique.mockResolvedValue({ id: 1 });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });
  it('stores exact grants without implicitly granting ancestors', async () => {
    prisma.navNode.findMany.mockResolvedValue([{ id: 3, parentId: 2 }]);
    await expect(
      service.setUserMenus(10, { menuIds: [3, 3] }),
    ).resolves.toEqual({ menuIds: [3] });
    expect(prisma.userMenu.createMany).toHaveBeenCalledWith({
      data: [{ userId: 10, menuId: 3 }],
    });
  });
  it('supports removing every grant', async () => {
    prisma.navNode.findMany.mockResolvedValue([]);
    await expect(service.setUserMenus(10, { menuIds: [] })).resolves.toEqual({
      menuIds: [],
    });
    expect(prisma.userMenu.deleteMany).toHaveBeenCalledWith({
      where: { userId: 10 },
    });
    expect(prisma.userMenu.createMany).not.toHaveBeenCalled();
  });
  it('rejects invalid and nonexistent menu ids', async () => {
    await expect(
      service.setUserMenus(10, { menuIds: ['3'] }),
    ).rejects.toThrow();
    prisma.navNode.findMany.mockResolvedValue([]);
    await expect(service.setUserMenus(10, { menuIds: [999] })).rejects.toThrow(
      '不存在',
    );
  });
  it('rejects JavaScript and protocol-relative URLs', async () => {
    const body = { title: 'test', permissionKey: 'test.menu' };
    await expect(
      service.createMenu({ ...body, url: 'javascript:alert(1)' }),
    ).rejects.toThrow();
    await expect(
      service.createMenu({ ...body, url: '//example.com' }),
    ).rejects.toThrow();
  });
  it('rejects moving a parent beneath its descendant', async () => {
    prisma.navNode.findMany.mockResolvedValue([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
    ]);
    await expect(
      service.updateMenu(1, {
        title: 'test',
        permissionKey: 'test.menu',
        parentId: 2,
      }),
    ).rejects.toThrow('子菜单');
    expect(prisma.navNode.update).not.toHaveBeenCalled();
  });
});
