import { Test, TestingModule } from '@nestjs/testing';
import { NavService } from './nav.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('NavService', () => {
  let service: NavService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NavService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<NavService>(NavService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
