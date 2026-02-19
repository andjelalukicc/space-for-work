/**
 * UNIT TESTOVI ZA BOOKINGS SERVICE
 *
 * Ovo su NAJVAZNIJI testovi jer pokrivaju svu biznis logiku rezervacija:
 * - Uspesno kreiranje rezervacije
 * - Validacija minimalnog trajanja (30 min)
 * - Validacija intervala (koraci od 30 min)
 * - Max 3 rezervacije po danu
 * - Detekcija preklapanja za sobu
 * - Detekcija preklapanja za korisnika
 * - Otkazivanje rezervacije
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking } from './booking.entity';

// Mock RabbitMQ klijent - simulira slanje poruka
const mockNotificationsClient = {
  emit: jest.fn(),
};

// Mock QueryBuilder - simulira slozene SQL upite za proveru preklapanja
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getCount: jest.fn(),
};

// Mock repozitorijum za bookings tabelu
const mockRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: mockRepository,
        },
        {
          provide: 'NOTIFICATIONS_SERVICE',
          useValue: mockNotificationsClient,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
    // Resetujemo i QueryBuilder mock-ove
    mockQueryBuilder.getCount.mockResolvedValue(0);
  });

  // ==================== KREIRANJE REZERVACIJE ====================

  describe('create', () => {
    const validBooking = {
      roomId: 'room-uuid',
      date: '2026-03-01',
      startTime: '09:00',
      endTime: '10:00',
    };

    it('treba uspesno da kreira rezervaciju sa validnim podacima', async () => {
      // Priprema: nema preklapanja, korisnik ima manje od 3 rezervacije
      mockRepository.count.mockResolvedValue(0);
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockRepository.create.mockReturnValue({
        id: 'booking-uuid',
        userId: 'user-uuid',
        ...validBooking,
        status: 'active',
      });
      mockRepository.save.mockResolvedValue({
        id: 'booking-uuid',
        userId: 'user-uuid',
        ...validBooking,
        status: 'active',
        createdAt: new Date(),
      });

      const result = await service.create('user-uuid', validBooking);

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-uuid');
      expect(result.status).toBe('active');
      // Proveravamo da je RabbitMQ event emitovan
      expect(mockNotificationsClient.emit).toHaveBeenCalledWith(
        'booking_created',
        expect.objectContaining({
          bookingId: 'booking-uuid',
          userId: 'user-uuid',
        }),
      );
    });

    it('treba da baci gresku ako je endTime pre startTime', async () => {
      await expect(
        service.create('user-uuid', {
          ...validBooking,
          startTime: '10:00',
          endTime: '09:00', // Kraj pre pocetka!
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('treba da baci gresku ako je trajanje manje od 30 minuta', async () => {
      await expect(
        service.create('user-uuid', {
          ...validBooking,
          startTime: '09:00',
          endTime: '09:15', // Samo 15 minuta
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('treba da baci gresku ako vremena nisu u intervalima od 30 min', async () => {
      await expect(
        service.create('user-uuid', {
          ...validBooking,
          startTime: '09:15', // 15 nije validan interval
          endTime: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('treba da baci gresku ako korisnik vec ima 3 rezervacije taj dan', async () => {
      mockRepository.count.mockResolvedValue(3); // Vec ima 3

      await expect(
        service.create('user-uuid', validBooking),
      ).rejects.toThrow(ConflictException);
    });

    it('treba da baci gresku ako se soba preklapa sa postojecom rezervacijom', async () => {
      mockRepository.count.mockResolvedValue(0); // Manje od 3 dnevno
      // Prvi poziv getCount (room overlap) vraca 1 - ima preklapanje
      mockQueryBuilder.getCount.mockResolvedValueOnce(1);

      await expect(
        service.create('user-uuid', validBooking),
      ).rejects.toThrow(ConflictException);
    });

    it('treba da baci gresku ako korisnik ima preklapajucu rezervaciju', async () => {
      mockRepository.count.mockResolvedValue(0);
      // Prvi poziv (room overlap) = 0, drugi poziv (user overlap) = 1
      mockQueryBuilder.getCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      await expect(
        service.create('user-uuid', validBooking),
      ).rejects.toThrow(ConflictException);
    });

    it('treba da dozvoli rezervaciju od 2 sata', async () => {
      mockRepository.count.mockResolvedValue(0);
      mockQueryBuilder.getCount.mockResolvedValue(0);
      const longBooking = {
        ...validBooking,
        startTime: '09:00',
        endTime: '11:00', // 2 sata
      };
      mockRepository.create.mockReturnValue({
        id: 'booking-uuid',
        userId: 'user-uuid',
        ...longBooking,
        status: 'active',
      });
      mockRepository.save.mockResolvedValue({
        id: 'booking-uuid',
        userId: 'user-uuid',
        ...longBooking,
        status: 'active',
        createdAt: new Date(),
      });

      const result = await service.create('user-uuid', longBooking);
      expect(result).toBeDefined();
    });
  });

  // ==================== OTKAZIVANJE REZERVACIJE ====================

  describe('cancel', () => {
    it('treba uspesno da otkaze rezervaciju', async () => {
      const booking = {
        id: 'booking-uuid',
        userId: 'user-uuid',
        roomId: 'room-uuid',
        date: '2026-03-01',
        startTime: '09:00',
        endTime: '10:00',
        status: 'active',
      };
      mockRepository.findOne.mockResolvedValue({ ...booking });
      mockRepository.save.mockResolvedValue({ ...booking, status: 'cancelled' });

      const result = await service.cancel('booking-uuid', 'user-uuid');

      expect(result.status).toBe('cancelled');
      expect(mockNotificationsClient.emit).toHaveBeenCalledWith(
        'booking_cancelled',
        expect.objectContaining({ bookingId: 'booking-uuid' }),
      );
    });

    it('treba da baci gresku ako korisnik pokusa da otkaze tudju rezervaciju', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'booking-uuid',
        userId: 'drugi-user', // Nije isti korisnik
        status: 'active',
      });

      await expect(
        service.cancel('booking-uuid', 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('treba da baci gresku ako je rezervacija vec otkazana', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'booking-uuid',
        userId: 'user-uuid',
        status: 'cancelled', // Vec otkazana
      });

      await expect(
        service.cancel('booking-uuid', 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('treba da baci NotFoundException ako rezervacija ne postoji', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancel('nepostoji', 'user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== PRETRAGA ====================

  describe('findByUser', () => {
    it('treba da vrati rezervacije korisnika', async () => {
      const bookings = [
        { id: '1', userId: 'user-uuid', date: '2026-03-01', startTime: '09:00' },
        { id: '2', userId: 'user-uuid', date: '2026-03-01', startTime: '14:00' },
      ];
      mockRepository.find.mockResolvedValue(bookings);

      const result = await service.findByUser('user-uuid');

      expect(result).toHaveLength(2);
    });
  });

  describe('findByRoom', () => {
    it('treba da vrati aktivne rezervacije za sobu na dati datum', async () => {
      mockRepository.find.mockResolvedValue([
        { id: '1', roomId: 'room-uuid', date: '2026-03-01', status: 'active' },
      ]);

      const result = await service.findByRoom('room-uuid', '2026-03-01');

      expect(result).toHaveLength(1);
    });
  });
});
