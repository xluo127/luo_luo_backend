import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { categoryInput, integerInput, objectInput, pointInput, textInput } from './learning.validation.js';

const pointInclude = {
  category: { select: { id: true, name: true, slug: true } },
  note: true,
  questions: { orderBy: { sortOrder: 'asc' as const } },
  examples: { orderBy: { sortOrder: 'asc' as const } },
};

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(categorySlug?: string, allowedCategoryIds?: number[]) {
    const [categories, points, allPoints] = await Promise.all([
      this.getCategories(allowedCategoryIds),
      this.getPoints(categorySlug, allowedCategoryIds),
      this.prisma.knowledgePoint.findMany({ where: allowedCategoryIds ? { categoryId: { in: allowedCategoryIds } } : undefined, select: { progress: true } }),
    ]);
    return {
      categories,
      points,
      stats: {
        total: allPoints.length,
        completed: allPoints.filter((point) => point.progress === 100).length,
        inProgress: allPoints.filter((point) => point.progress > 0 && point.progress < 100).length,
        averageProgress: allPoints.length
          ? Math.round(allPoints.reduce((total, point) => total + point.progress, 0) / allPoints.length)
          : 0,
      },
    };
  }

  async getCategories(allowedCategoryIds?: number[]) {
    const categories = await this.prisma.learningCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { points: true } } },
    });
    type CategoryNode = (typeof categories)[number] & { children: CategoryNode[]; pointCount: number };
    const included = new Set(allowedCategoryIds ?? categories.map((category) => category.id));
    for (const categoryId of included) {
      let category = categories.find((item) => item.id === categoryId);
      const visited = new Set<number>();
      while (category?.parentId && !visited.has(category.parentId)) {
        visited.add(category.parentId);
        included.add(category.parentId);
        category = categories.find((item) => item.id === category!.parentId);
      }
    }
    const nodes = new Map<number, CategoryNode & { canAccess: boolean }>(categories.filter((category) => included.has(category.id)).map((category) => {
      const canAccess = !allowedCategoryIds || allowedCategoryIds.includes(category.id);
      const pointCount = canAccess ? category._count.points : 0;
      return [category.id, { ...category, _count: { points: pointCount }, pointCount, canAccess, children: [] }];
    }));
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    const countPoints = (node: CategoryNode): number => {
      node.pointCount += node.children.reduce((total, child) => total + countPoints(child), 0);
      return node.pointCount;
    };
    roots.forEach(countPoints);
    return roots;
  }

  async createCategory(input: unknown) {
    const data = categoryInput(input);
    if (data.parentId !== null) await this.assertCategory(data.parentId);
    return this.prisma.learningCategory.create({ data: { ...data, slug: `category-${randomUUID()}` } });
  }

  async updateCategory(id: number, input: unknown) {
    await this.assertCategory(id);
    const data = categoryInput(input);
    if (data.parentId !== null) {
      await this.assertCategory(data.parentId);
      const categories = await this.prisma.learningCategory.findMany({ select: { id: true, parentId: true } });
      const parents = new Map(categories.map((category) => [category.id, category.parentId]));
      let ancestor: number | null = data.parentId;
      const visited = new Set<number>();
      while (ancestor !== null) {
        if (ancestor === id || visited.has(ancestor)) {
          throw new BadRequestException('不能将分类移动到自身或其子分类下');
        }
        visited.add(ancestor);
        ancestor = parents.get(ancestor) ?? null;
      }
    }
    return this.prisma.learningCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: number) {
    await this.assertCategory(id);
    const [children, points] = await Promise.all([
      this.prisma.learningCategory.count({ where: { parentId: id } }),
      this.prisma.knowledgePoint.count({ where: { categoryId: id } }),
    ]);
    if (children || points) throw new ConflictException('请先移走知识点并删除子分类，只允许删除空分类');
    await this.prisma.learningCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async getPoints(categorySlug?: string, allowedCategoryIds?: number[]) {
    let categoryIds: number[] | undefined;
    if (categorySlug) {
      const categories = await this.prisma.learningCategory.findMany({ select: { id: true, slug: true, parentId: true } });
      const selected = categories.find((category) => category.slug === categorySlug);
      if (!selected) throw new NotFoundException('学习分类不存在');
      const ids = new Set([selected.id]);
      const pending = [selected.id];
      while (pending.length) {
        const parentId = pending.pop();
        for (const category of categories) {
          if (category.parentId === parentId && !ids.has(category.id)) {
            ids.add(category.id);
            pending.push(category.id);
          }
        }
      }
      categoryIds = [...ids];
    }
    if (allowedCategoryIds) {
      categoryIds = categoryIds ? categoryIds.filter((id) => allowedCategoryIds.includes(id)) : allowedCategoryIds;
      if (categorySlug && !categoryIds.length) throw new ForbiddenException('没有该学习分类的菜单权限');
    }
    return this.prisma.knowledgePoint.findMany({
      where: categoryIds ? { categoryId: { in: categoryIds } } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { questions: true, examples: true } },
      },
    });
  }

  async getPoint(id: number) {
    integerInput(id, '知识点 ID');
    const point = await this.prisma.knowledgePoint.findUnique({
      where: { id },
      include: {
        ...pointInclude,
        attempts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!point) throw new NotFoundException('知识点不存在');
    return {
      ...point,
      questions: point.questions.map(({ id: questionId, prompt, options }) => ({ id: questionId, prompt, options })),
    };
  }

  async getPointForEditor(id: number) {
    integerInput(id, '知识点 ID');
    const point = await this.prisma.knowledgePoint.findUnique({ where: { id }, include: pointInclude });
    if (!point) throw new NotFoundException('知识点不存在');
    return point;
  }

  async createPoint(input: unknown) {
    const { note, questions, examples, ...data } = pointInput(input);
    await this.assertCategory(data.categoryId);
    return this.prisma.knowledgePoint.create({
      data: {
        ...data,
        slug: `point-${randomUUID()}`,
        note: { create: note },
        questions: { create: questions },
        examples: { create: examples },
      },
    });
  }

  async updatePoint(id: number, input: unknown) {
    await this.assertPoint(id);
    const { note, questions, examples, ...data } = pointInput(input);
    await this.assertCategory(data.categoryId);
    return this.prisma.knowledgePoint.update({
      where: { id },
      data: {
        ...data,
        note: { upsert: { create: note, update: note } },
        questions: { deleteMany: {}, create: questions },
        examples: { deleteMany: {}, create: examples },
      },
    });
  }

  async deletePoint(id: number) {
    await this.assertPoint(id);
    await this.prisma.knowledgePoint.delete({ where: { id } });
    return { deleted: true };
  }

  async updateProgress(id: number, input: unknown) {
    await this.assertPoint(id);
    const progress = integerInput(objectInput(input).progress, '学习进度', 0, 100);
    return this.prisma.knowledgePoint.update({
      where: { id },
      data: { progress, status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started' },
    });
  }

  async saveNote(id: number, input: unknown) {
    await this.assertPoint(id);
    const body = objectInput(input);
    const data = {
      keyPoints: textInput(body.keyPoints, '核心要点', 60000, false),
      body: textInput(body.body, '学习笔记', 60000, false),
    };
    return this.prisma.learningNote.upsert({
      where: { knowledgePointId: id },
      create: { ...data, knowledgePointId: id },
      update: data,
    });
  }

  async submitQuiz(id: number, input: unknown) {
    const answers = objectInput(objectInput(input).answers);
    const point = await this.getPointForEditor(id);
    if (!point.questions.length) throw new BadRequestException('当前知识点尚未配置题目');
    const validIds = new Set(point.questions.map((question) => String(question.id)));
    if (Object.keys(answers).some((questionId) => !validIds.has(questionId))) {
      throw new BadRequestException('题目已更新，请刷新后重新答题');
    }
    const results = point.questions.map((question) => {
      const answer = textInput(answers[String(question.id)], '每道题的答案', 1000);
      const options = question.options as string[];
      if (!options.includes(answer)) throw new BadRequestException('答案必须是题目提供的选项');
      return {
        questionId: question.id,
        prompt: question.prompt,
        answer,
        correctAnswer: question.answer,
        correct: answer === question.answer,
        explanation: question.explanation ?? '',
      };
    });
    const correctCount = results.filter((result) => result.correct).length;
    return this.prisma.quizAttempt.create({
      data: {
        knowledgePointId: id,
        score: Math.round((correctCount / results.length) * 100),
        correctCount,
        totalCount: results.length,
        results: results as Prisma.InputJsonValue,
      },
    });
  }

  private async assertCategory(id: number) {
    integerInput(id, '分类 ID');
    if (!await this.prisma.learningCategory.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException('学习分类不存在');
    }
  }

  private async assertPoint(id: number) {
    integerInput(id, '知识点 ID');
    if (!await this.prisma.knowledgePoint.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException('知识点不存在');
    }
  }
}
