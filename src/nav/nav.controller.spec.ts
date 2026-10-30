import { Test, TestingModule } from '@nestjs/testing';
import { NavController } from './nav.controller.js';
import { NavService } from './nav.service.js';

describe('NavController', () => {
  let controller: NavController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NavController],
      providers: [NavService],
    }).compile();

    controller = module.get<NavController>(NavController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
