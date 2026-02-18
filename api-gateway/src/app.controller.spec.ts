import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(result.services).toContain('users');
      expect(result.services).toContain('rooms');
      expect(result.services).toContain('bookings');
      expect(result.services).toContain('notifications');
    });
  });
});
