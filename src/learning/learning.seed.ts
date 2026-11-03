import { Prisma } from '@prisma/client';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const categories = [
  { name: '前端开发', slug: 'frontend', description: '浏览器、页面与交互体验的系统学习', parentSlug: null, sortOrder: 1 },
  { name: 'JavaScript', slug: 'javascript', description: '语言基础、异步编程与运行机制', parentSlug: 'frontend', sortOrder: 1 },
  { name: 'CSS', slug: 'css', description: '布局、视觉表现与工程化样式', parentSlug: 'frontend', sortOrder: 2 },
  { name: 'Vue', slug: 'vue', description: 'Vue 组件化开发与生态实践', parentSlug: 'frontend', sortOrder: 3 },
  { name: '后端开发', slug: 'backend', description: '服务端、接口与数据持久化', parentSlug: null, sortOrder: 2 },
  { name: 'Node.js', slug: 'nodejs', description: 'Node.js 运行时与服务端基础', parentSlug: 'backend', sortOrder: 1 },
  { name: 'NestJS', slug: 'nestjs', description: 'NestJS 模块化服务端实践', parentSlug: 'backend', sortOrder: 2 },
  { name: '数据库', slug: 'database', description: '关系型数据库、建模与查询', parentSlug: null, sortOrder: 3 },
  { name: '工程化', slug: 'engineering', description: 'Git、构建、测试与部署', parentSlug: null, sortOrder: 4 },
] as const;

const points = [
  {
    categorySlug: 'javascript', title: '变量、作用域与闭包', slug: 'scope-and-closure', progress: 72,
    summary: '理解词法作用域、执行上下文，以及闭包如何保存外部变量。',
    keyPoints: '作用域决定变量可见范围；闭包是函数与其词法环境的组合；优先使用 const / let，谨慎依赖隐式全局变量。',
    body: '学习时可以从“函数为什么还能访问外层变量”这个问题切入，再结合模块化和事件回调理解闭包的实际价值。',
    question: { prompt: '闭包最核心的特征是什么？', options: ['函数可以访问定义时所在作用域的变量', '函数一定没有参数', '函数只能执行一次'], answer: '函数可以访问定义时所在作用域的变量', explanation: '闭包保留了函数定义时的词法环境。' },
    example: { title: '用闭包创建计数器', language: 'javascript', runnable: true, code: 'function createCounter() {\n  let count = 0\n  return () => ++count\n}\n\nconst counter = createCounter()\nconsole.log(counter())\nconsole.log(counter())', description: '每次调用返回的函数都能访问并更新外层的 count。' },
  },
  {
    categorySlug: 'javascript', title: 'Promise 与 async / await', slug: 'promise-async-await', progress: 35,
    summary: '掌握异步任务的状态、链式调用与错误处理方式。',
    keyPoints: 'Promise 有 pending、fulfilled、rejected 三种状态；async 函数总是返回 Promise；await 只能暂停当前 async 函数。',
    body: '把异步流程拆成“发起任务—等待结果—处理成功—处理失败”，比单纯记 API 更容易形成稳定的排错思路。',
    question: { prompt: 'async 函数的返回值是什么？', options: ['普通字符串', 'Promise', '一定是数组'], answer: 'Promise', explanation: 'async 函数会把返回值包装为已兑现的 Promise。' },
    example: { title: '串联异步任务', language: 'javascript', runnable: true, code: 'async function loadUser() {\n  const response = await fetch(\'/api/user\')\n  return response.json()\n}', description: '用 await 让异步流程保持清晰的顺序。' },
  },
  {
    categorySlug: 'css', title: 'Flex 布局', slug: 'flex-layout', progress: 58,
    summary: '使用主轴、交叉轴和空间分配快速构建一维布局。',
    keyPoints: 'display: flex 建立弹性格式化上下文；justify-content 控制主轴；align-items 控制交叉轴；flex-wrap 控制换行。',
    body: '遇到布局问题时，先明确容器的主轴方向，再分别检查容器属性和子项的 flex 属性。',
    question: { prompt: 'Flex 默认的主轴方向是什么？', options: ['row，从左到右', 'column，从上到下', '由浏览器随机决定'], answer: 'row，从左到右', explanation: 'flex-direction 的默认值为 row。' },
    example: { title: '居中卡片', language: 'html', runnable: true, code: '<style>\n.card { display: flex; align-items: center; justify-content: center; min-height: 140px; background: #dff7ee; border-radius: 16px; }\n</style>\n<div class="card">Flex 双轴居中</div>', description: '两个轴同时居中是最常见的 Flex 使用场景。' },
  },
  {
    categorySlug: 'vue', title: '组件通信与响应式', slug: 'vue-reactivity', progress: 18,
    summary: '理解 ref、computed，以及父子组件之间的数据流动。',
    keyPoints: 'ref 用于创建响应式值；computed 表示派生状态；props 向下传递，emit 向上通知；单向数据流便于维护。',
    body: '组件设计时优先让数据拥有唯一来源，避免为了方便在多个组件中复制同一份状态。',
    question: { prompt: 'Vue 中子组件向父组件传递事件通常使用什么？', options: ['emit', 'watch', 'provide'], answer: 'emit', explanation: '子组件通过 emit 发出事件，父组件监听并响应。' },
    example: { title: '响应式计数器', language: 'html', runnable: true, code: '<button id="counter">点击次数：0</button>\n<script>\nlet count = 0\ndocument.querySelector(\'#counter\').onclick = () => {\n  count += 1\n  document.querySelector(\'#counter\').textContent = `点击次数：${count}`\n}\n</script>', description: '用一个可运行的小例子感受状态变化驱动视图更新。' },
  },
  {
    categorySlug: 'nestjs', title: '模块、控制器与服务', slug: 'nestjs-core', progress: 0,
    summary: '建立 NestJS 应用的模块化思维，理解依赖注入和职责分离。',
    keyPoints: 'Module 组织边界；Controller 处理请求；Service 承载业务；依赖注入让组件易于替换和测试。',
    body: '先把请求入口、业务逻辑和数据访问拆开，再考虑复用和跨模块依赖。',
    question: { prompt: 'NestJS 中用于组织控制器和提供者的是哪个装饰器？', options: ['@Module', '@Route', '@InjectableOnly'], answer: '@Module', explanation: '@Module 描述模块的 imports、controllers、providers 和 exports。' },
    example: { title: '一个最小服务', language: 'typescript', runnable: false, code: '@Injectable()\nexport class GreetingService {\n  greet(name: string) {\n    return `Hello, ${name}`\n  }\n}', description: '服务类聚焦业务逻辑，由控制器负责调用。' },
  },
] as const;

export async function seedLearningData(prisma: PrismaService) {
  if (await prisma.learningCategory.count()) return;
  const categoryIds = new Map<string, number>();
  for (const category of categories) {
    const created = await prisma.learningCategory.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentSlug ? categoryIds.get(category.parentSlug) : null,
        sortOrder: category.sortOrder,
      },
    });
    categoryIds.set(category.slug, created.id);
  }
  for (const point of points) {
    await prisma.knowledgePoint.create({
      data: {
        categoryId: categoryIds.get(point.categorySlug)!,
        title: point.title,
        slug: point.slug,
        summary: point.summary,
        progress: point.progress,
        status: point.progress ? 'in_progress' : 'not_started',
        note: { create: { keyPoints: point.keyPoints, body: point.body } },
        questions: { create: [{ ...point.question, options: point.question.options as Prisma.InputJsonValue }] },
        examples: { create: [point.example] },
      },
    });
  }
}

@Injectable()
export class LearningSeedService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await seedLearningData(this.prisma);
  }
}
