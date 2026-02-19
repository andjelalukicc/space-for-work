/**
 * UNIT TESTOVI ZA API GATEWAY
 *
 * Testiramo health endpoint koji vraca status gateway-a.
 */
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
    it('treba da vrati status ok sa listom servisa', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.services).toContain('users');
      expect(result.services).toContain('rooms');
      expect(result.services).toContain('bookings');
      expect(result.services).toContain('notifications');
      expect(result.services).toHaveLength(4);
    });
  });
});
