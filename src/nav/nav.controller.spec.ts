import { Test, TestingModule } from '@nestjs/testing';
import { NavController } from './nav.controller.js';
import { NavService } from './nav.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('NavController', () => {
  let controller: NavController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NavController],
      providers: [NavService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<NavController>(NavController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
