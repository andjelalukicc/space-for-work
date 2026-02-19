/**
 * UNIT TESTOVI ZA ROOMS SERVICE
 *
 * Testiramo:
 * - Pronalazenje svih aktivnih prostorija
 * - Pronalazenje prostorije po ID-u
 * - Pronalazenje prostorija po tipu
 * - Seed funkciju (kreiranje pocetnih podataka)
 * - SSE availability stream
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room } from './room.entity';

const mockRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
};

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('treba da vrati sve aktivne prostorije', async () => {
      const rooms = [
        { id: '1', name: 'Meeting Room Small', type: 'meeting_room', isActive: true },
        { id: '2', name: 'Phone Booth 1', type: 'phone_booth', isActive: true },
      ];
      mockRepository.find.mockResolvedValue(rooms);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  describe('findById', () => {
    it('treba da vrati prostoriju po ID-u', async () => {
      const room = {
        id: 'room-uuid',
        name: 'Meeting Room Small',
        type: 'meeting_room',
        capacity: 8,
      };
      mockRepository.findOne.mockResolvedValue(room);

      const result = await service.findById('room-uuid');

      expect(result.name).toBe('Meeting Room Small');
      expect(result.capacity).toBe(8);
    });

    it('treba da baci NotFoundException ako prostorija ne postoji', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nepostoji')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByType', () => {
    it('treba da vrati samo meeting room-ove', async () => {
      const meetingRooms = [
        { id: '1', name: 'Meeting Room Small', type: 'meeting_room' },
        { id: '2', name: 'Meeting Room Large', type: 'meeting_room' },
      ];
      mockRepository.find.mockResolvedValue(meetingRooms);

      const result = await service.findByType('meeting_room');

      expect(result).toHaveLength(2);
    });

    it('treba da vrati samo phone booth-ove', async () => {
      const booths = [
        { id: '3', name: 'Phone Booth 1', type: 'phone_booth' },
        { id: '4', name: 'Phone Booth 2', type: 'phone_booth' },
      ];
      mockRepository.find.mockResolvedValue(booths);

      const result = await service.findByType('phone_booth');

      expect(result).toHaveLength(2);
    });
  });

  describe('seed', () => {
    it('treba da kreira 8 prostorija ako je tabela prazna', async () => {
      mockRepository.count.mockResolvedValue(0); // Tabela je prazna
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve(data));

      await service.onModuleInit();

      // Proveravamo da je save pozvan 8 puta (2 meeting + 6 phone)
      expect(mockRepository.save).toHaveBeenCalledTimes(8);
    });

    it('ne treba da kreira prostorije ako vec postoje', async () => {
      mockRepository.count.mockResolvedValue(8); // Tabela vec ima podatke

      await service.onModuleInit();

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('availability stream (SSE)', () => {
    it('treba da emituje dogadjaj kroz stream', (done) => {
      // Pretplacujemo se na stream
      const subscription = service.getAvailabilityStream().subscribe((event) => {
        expect(event.roomId).toBe('room-uuid');
        expect(event.event).toBe('booking_created');
        subscription.unsubscribe();
        done();
      });

      // Emitujemo dogadjaj
      service.emitAvailabilityChange('room-uuid', 'booking_created');
    });
  });
});
