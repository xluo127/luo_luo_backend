import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('requires login by default', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(401);
  });

  it('protects navigation and learning APIs', async () => {
    await request(app.getHttpServer()).get('/nav').expect(401);
    await request(app.getHttpServer()).get('/learning/overview').expect(401);
    await request(app.getHttpServer()).get('/permissions/menus').expect(401);
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
