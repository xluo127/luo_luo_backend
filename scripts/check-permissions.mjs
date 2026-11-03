import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const baseUrl = process.env.PERMISSION_TEST_BASE_URL || 'http://localhost:3000';
const prefix = `authcheck_${Date.now()}_${randomBytes(3).toString('hex')}`;
const usernames = [`${prefix}_admin`, `${prefix}_user`];
const password = randomBytes(24).toString('hex');
const temporaryMenus = [];
let checks = 0;

async function call(
  path,
  { method = 'GET', body, cookie, status = 200, securityHeader = true } = {},
) {
  const headers = {};
  if (securityHeader) headers['X-Luo-Request'] = '1';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks += 1;
  return {
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    setCookie: response.headers.get('set-cookie'),
  };
}

try {
  const before = await prisma.knowledgePoint.count();
  await call('/nav', { status: 401 });
  await call('/auth/login', {
    method: 'POST',
    body: {},
    securityHeader: false,
    status: 403,
  });
  const adminRegistration = await call('/auth/register', {
    method: 'POST',
    body: {
      username: usernames[0],
      password,
      displayName: 'Temporary Admin',
      isAdmin: true,
    },
    status: 201,
  });
  assert.equal(adminRegistration.data.user.isAdmin, false);
  assert.ok(adminRegistration.setCookie.includes('HttpOnly'));
  assert.ok(adminRegistration.setCookie.includes('SameSite=Lax'));
  assert.equal(adminRegistration.data.token, undefined);
  await prisma.user.update({
    where: { username: usernames[0] },
    data: { isAdmin: true },
  });
  const adminCookie = adminRegistration.cookie;
  const userRegistration = await call('/auth/register', {
    method: 'POST',
    body: {
      username: usernames[1],
      password,
      displayName: 'Temporary Learner',
    },
    status: 201,
  });
  const userCookie = userRegistration.cookie;
  const userId = userRegistration.data.user.id;
  assert.deepEqual((await call('/nav', { cookie: userCookie })).data, []);
  await call('/learning/overview', { cookie: userCookie, status: 403 });
  await call('/users', { cookie: userCookie, status: 403 });
  await call('/permissions/menus', { cookie: userCookie, status: 403 });
  await call(`/permissions/users/${userId}/menus`, {
    method: 'PUT',
    cookie: userCookie,
    body: { menuIds: [] },
    status: 403,
  });
  await call('/auth/register', {
    method: 'POST',
    body: { username: usernames[1], password },
    status: 409,
  });
  await call('/auth/login', {
    method: 'POST',
    body: { username: usernames[1], password: 'wrong-password' },
    status: 401,
  });
  const configuration = (
    await call('/permissions/menus', { cookie: adminCookie })
  ).data;
  const javascriptMenu = configuration.flat.find(
    (menu) => menu.url === '/learning?category=javascript',
  );
  assert.ok(javascriptMenu, 'Requires the seeded JavaScript menu');
  await call(`/permissions/users/${userId}/menus`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { menuIds: [javascriptMenu.id] },
  });
  const tree = (await call('/nav', { cookie: userCookie })).data;
  const flatten = (nodes) =>
    nodes.flatMap((node) => [node, ...flatten(node.children)]);
  assert.deepEqual(
    flatten(tree)
      .filter((node) => node.clickable)
      .map((node) => node.id),
    [javascriptMenu.id],
  );
  const overview = (
    await call('/learning/overview?category=javascript', { cookie: userCookie })
  ).data;
  assert.ok(
    overview.points.every((point) => point.category.slug === 'javascript'),
  );
  assert.equal(overview.stats.total, overview.points.length);
  assert.ok(!JSON.stringify(overview.categories).includes('"slug":"css"'));
  await call('/learning/points?category=css', {
    cookie: userCookie,
    status: 403,
  });
  const otherPoint = await prisma.knowledgePoint.findFirst({
    where: { category: { slug: 'css' } },
  });
  assert.ok(otherPoint);
  for (const suffix of ['', '/editor'])
    await call(`/learning/points/${otherPoint.id}${suffix}`, {
      cookie: userCookie,
      status: 403,
    });
  await call(`/learning/points/${otherPoint.id}/note`, {
    method: 'PUT',
    cookie: userCookie,
    body: { keyPoints: '', body: '' },
    status: 403,
  });
  await call('/learning/points', {
    method: 'POST',
    cookie: userCookie,
    body: { categoryId: otherPoint.categoryId },
    status: 403,
  });
  await call(`/learning/points/${otherPoint.id}`, {
    method: 'DELETE',
    cookie: userCookie,
    status: 403,
  });
  const users = (await call('/users', { cookie: adminCookie })).data;
  assert.ok(users.every((user) => !Object.hasOwn(user, 'passwordHash')));
  await call(`/users/${adminRegistration.data.user.id}`, {
    method: 'DELETE',
    cookie: adminCookie,
    status: 409,
  });
  const menuBody = {
    title: 'Temporary Menu',
    permissionKey: prefix,
    url: '/learning?category=javascript',
    parentId: null,
    visible: true,
    sortOrder: 999,
  };
  const menu = (
    await call('/permissions/menus', {
      method: 'POST',
      cookie: adminCookie,
      body: menuBody,
      status: 201,
    })
  ).data;
  temporaryMenus.push(menu.id);
  await call(`/permissions/users/${userId}/menus`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { menuIds: [menu.id] },
  });
  await call(`/permissions/menus/${menu.id}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { ...menuBody, visible: false },
  });
  assert.deepEqual((await call('/nav', { cookie: userCookie })).data, []);
  await call('/learning/overview', { cookie: userCookie, status: 403 });
  await call(`/permissions/menus/${menu.id}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { ...menuBody, parentId: menu.id },
    status: 400,
  });
  await call(`/permissions/menus/${menu.id}`, {
    method: 'DELETE',
    cookie: adminCookie,
  });
  await call(`/permissions/users/${userId}/menus`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { menuIds: [javascriptMenu.id] },
  });
  await call('/learning/overview', { cookie: userCookie });
  await call(`/permissions/users/${userId}/menus`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { menuIds: [] },
  });
  await call('/learning/overview', { cookie: userCookie, status: 403 });
  const login = await call('/auth/login', {
    method: 'POST',
    body: { username: usernames[1], password },
    status: 201,
  });
  await call('/auth/logout', {
    method: 'POST',
    cookie: login.cookie,
    status: 201,
  });
  await call('/auth/me', { cookie: login.cookie, status: 401 });
  await call(`/users/${userId}`, { method: 'DELETE', cookie: adminCookie });
  await call('/auth/me', { cookie: userCookie, status: 401 });
  assert.equal(await prisma.knowledgePoint.count(), before);
  console.log(
    `Permission integration passed: ${checks} HTTP checks; existing learning content unchanged.`,
  );
} finally {
  await prisma.user.deleteMany({ where: { username: { in: usernames } } });
  if (temporaryMenus.length)
    await prisma.navNode.deleteMany({
      where: { id: { in: temporaryMenus }, permissionKey: prefix },
    });
  await prisma.$disconnect();
}
