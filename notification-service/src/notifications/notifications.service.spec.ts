/**
 * UNIT TESTOVI ZA NOTIFICATIONS SERVICE
 *
 * Testiramo:
 * - Kreiranje notifikacije
 * - Dohvatanje notifikacija za korisnika
 * - Oznacavanje notifikacije kao procitane
 * - Obradu booking_created dogadjaja
 * - Obradu booking_cancelled dogadjaja
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';

const mockRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('treba da kreira notifikaciju', async () => {
      mockRepository.create.mockReturnValue({
        userId: 'user-uuid',
        type: 'booking_created',
        message: 'Test message',
      });
      mockRepository.save.mockResolvedValue({
        id: 'notif-uuid',
        userId: 'user-uuid',
        type: 'booking_created',
        message: 'Test message',
        isRead: false,
        createdAt: new Date(),
      });

      const result = await service.create(
        'user-uuid',
        'booking_created',
        'Test message',
      );

      expect(result.id).toBe('notif-uuid');
      expect(result.isRead).toBe(false);
    });
  });

  describe('findByUser', () => {
    it('treba da vrati notifikacije sortirane po datumu (najnovije prvo)', async () => {
      const notifications = [
        { id: '2', userId: 'user-uuid', createdAt: new Date('2026-03-02') },
        { id: '1', userId: 'user-uuid', createdAt: new Date('2026-03-01') },
      ];
      mockRepository.find.mockResolvedValue(notifications);

      const result = await service.findByUser('user-uuid');

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('markAsRead', () => {
    it('treba da oznaci notifikaciju kao procitanu', async () => {
      const notification = {
        id: 'notif-uuid',
        isRead: false,
      };
      mockRepository.findOne.mockResolvedValue({ ...notification });
      mockRepository.save.mockResolvedValue({ ...notification, isRead: true });

      const result = await service.markAsRead('notif-uuid');

      expect(result.isRead).toBe(true);
    });

    it('treba da baci NotFoundException ako notifikacija ne postoji', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('nepostoji')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleBookingCreated', () => {
    it('treba da kreira notifikaciju sa porukom o potvrdi', async () => {
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: 'notif-uuid', ...data }),
      );

      const result = await service.handleBookingCreated({
        bookingId: 'booking-uuid',
        userId: 'user-uuid',
        roomId: 'room-uuid',
        date: '2026-03-01',
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.type).toBe('booking_created');
      expect(result.message).toContain('confirmed');
      expect(result.message).toContain('09:00');
      expect(result.message).toContain('10:00');
    });
  });

  describe('handleBookingCancelled', () => {
    it('treba da kreira notifikaciju sa porukom o otkazivanju', async () => {
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) =>
        Promise.resolve({ id: 'notif-uuid', ...data }),
      );

      const result = await service.handleBookingCancelled({
        bookingId: 'booking-uuid',
        userId: 'user-uuid',
        roomId: 'room-uuid',
        date: '2026-03-01',
        startTime: '09:00',
        endTime: '10:00',
      });

      expect(result.type).toBe('booking_cancelled');
      expect(result.message).toContain('cancelled');
    });
  });
});
