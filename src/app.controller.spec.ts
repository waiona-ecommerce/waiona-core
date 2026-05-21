import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('healthCheck should return status ok', () => {
    const result = appController.healthCheck();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });
});
