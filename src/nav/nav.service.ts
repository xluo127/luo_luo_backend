import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 实例化 Prisma 客户端
const prisma = new PrismaClient();

@Injectable()
export class NavService {
  // 查询所有节点
  async findAll() {
    return await prisma.navNode.findMany();
  }
}