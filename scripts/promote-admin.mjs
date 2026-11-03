import { PrismaClient } from '@prisma/client';

const username = process.argv
  .slice(2)
  .find((argument) => argument !== '--')
  ?.trim()
  .toLowerCase();
if (!username || !/^[a-z0-9][a-z0-9_.-]{2,49}$/.test(username)) {
  console.error(
    '用法：pnpm user:promote -- 用户名（先在页面注册，再运行此命令）',
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user) throw new Error('用户不存在，请先注册该账号');
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  console.log(`用户 ${username} 已设为管理员。刷新页面即可进入权限中心。`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
