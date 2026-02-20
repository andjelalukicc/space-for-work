/**
 * ===================================================================
 * E2E TESTOVI ZA BOOKING SERVICE
 * ===================================================================
 *
 * Ovi testovi proveravaju rad kontrolera za rezervacije (BookingsController)
 * koristeci NestJS Testing modul sa mock repozitorijumom i mock RabbitMQ klijentom.
 * Ne koristi se prava baza podataka - svi podaci su simulirani (mokovani).
 *
 * Testiramo sledece rute:
 *   POST   /bookings              - Kreiranje nove rezervacije
 *   GET    /bookings              - Preuzimanje svih rezervacija korisnika
 *   DELETE /bookings/:id          - Otkazivanje rezervacije
 *   GET    /bookings/room/:roomId - Preuzimanje rezervacija za sobu po datumu
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BookingsController } from '../src/bookings/bookings.controller';
import { BookingsService } from '../src/bookings/bookings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from '../src/bookings/booking.entity';

// Primer podataka za testiranje - simulacija rezervacije iz baze
const mockBooking: Booking = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  roomId: 'room-456',
  date: '2026-03-01',
  startTime: '09:00',
  endTime: '10:00',
  status: 'active',
  createdAt: new Date('2026-02-20T12:00:00Z'),
};

// Mock QueryBuilder - simulira TypeORM query builder za provere preklapanja
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
};

// Mock repozitorijum - zamenjuje pravi TypeORM repozitorijum u testovima
const mockRepository = {
  create: jest.fn().mockReturnValue(mockBooking),
  save: jest.fn().mockResolvedValue(mockBooking),
  find: jest.fn().mockResolvedValue([mockBooking]),
  findOne: jest.fn().mockResolvedValue(mockBooking),
  count: jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

// Mock RabbitMQ klijent - simulira slanje poruka ka notification-service-u
const mockRabbitMQClient = {
  emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
  connect: jest.fn().mockResolvedValue(undefined),
};

describe('BookingsController (e2e)', () => {
  let app: INestApplication;

  // Pre svakog testa kreiramo novu NestJS aplikaciju sa mock zavisnostima
  beforeEach(async () => {
    // Resetujemo sve mock funkcije pre svakog testa
    jest.clearAllMocks();
    // Vracamo podrazumevane vrednosti za mock-ove
    mockQueryBuilder.getCount.mockResolvedValue(0);
    mockRepository.count.mockResolvedValue(0);
    mockRepository.create.mockReturnValue(mockBooking);
    mockRepository.save.mockResolvedValue(mockBooking);
    mockRepository.find.mockResolvedValue([mockBooking]);
    mockRepository.findOne.mockResolvedValue(mockBooking);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        BookingsService,
        // Zamenjujemo pravi TypeORM repozitorijum sa mock-om
        {
          provide: getRepositoryToken(Booking),
          useValue: mockRepository,
        },
        // Zamenjujemo pravi RabbitMQ klijent sa mock-om
        {
          provide: 'NOTIFICATIONS_SERVICE',
          useValue: mockRabbitMQClient,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Ukljucujemo ValidationPipe da bi DTO validacija radila u testovima
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  // Nakon svakog testa gasimo aplikaciju da oslobodimo resurse
  afterEach(async () => {
    await app.close();
  });

  // ===================================================================
  // Testovi za POST /bookings - Kreiranje nove rezervacije
  // ===================================================================

  describe('POST /bookings', () => {
    // Testiramo uspesno kreiranje rezervacije sa validnim podacima
    it('treba da kreira novu rezervaciju kada su svi podaci validni', () => {
      return request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123') // Simuliramo header koji bi API Gateway postavio
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(201) // HTTP 201 Created - rezervacija je uspesno kreirana
        .expect((res) => {
          // Proveravamo da odgovor sadrzi ocekivane podatke
          expect(res.body.id).toBe(mockBooking.id);
          expect(res.body.roomId).toBe('room-456');
          expect(res.body.status).toBe('active');
        });
    });

    // Testiramo da se RabbitMQ poruka salje nakon kreiranja rezervacije
    it('treba da emituje booking_created dogadjaj na RabbitMQ', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123')
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(201);

      // Proveravamo da je RabbitMQ klijent pozvao emit sa ispravnim dogadjajem
      expect(mockRabbitMQClient.emit).toHaveBeenCalledWith(
        'booking_created',
        expect.objectContaining({
          userId: 'user-123',
          roomId: 'room-456',
        }),
      );
    });

    // Testiramo da zahtev bez x-user-id header-a vraca 401 Unauthorized
    it('treba da vrati 401 ako nedostaje x-user-id header', () => {
      return request(app.getHttpServer())
        .post('/bookings')
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(401); // Neautorizovan pristup bez identifikacije korisnika
    });

    // Testiramo da ValidationPipe odbija nevalidan format datuma
    it('treba da vrati 400 za nevalidan format datuma', () => {
      return request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123')
        .send({
          roomId: 'room-456',
          date: '01-03-2026', // Pogresan format - treba YYYY-MM-DD
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(400); // Bad Request - validacija ne prolazi
    });

    // Testiramo da ValidationPipe odbija nevalidan format vremena
    it('treba da vrati 400 za nevalidan format vremena', () => {
      return request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123')
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '9:00', // Pogresan format - treba HH:MM (dve cifre)
          endTime: '10:00',
        })
        .expect(400);
    });

    // Testiramo da servis odbija rezervaciju kracu od 30 minuta
    it('treba da vrati 400 za rezervaciju kracu od 30 minuta', () => {
      return request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123')
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '09:00',
          endTime: '09:15', // Samo 15 minuta - minimum je 30
        })
        .expect(400);
    });

    // Testiramo da servis odbija kada korisnik ima vec 3 rezervacije tog dana
    it('treba da vrati 409 kada korisnik ima 3 aktivne rezervacije na taj dan', () => {
      // Simuliramo da korisnik vec ima 3 rezervacije
      mockRepository.count.mockResolvedValueOnce(3);

      return request(app.getHttpServer())
        .post('/bookings')
        .set('x-user-id', 'user-123')
        .send({
          roomId: 'room-456',
          date: '2026-03-01',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(409); // Conflict - prekoracen dnevni limit
    });
  });

  // ===================================================================
  // Testovi za GET /bookings - Preuzimanje rezervacija korisnika
  // ===================================================================

  describe('GET /bookings', () => {
    // Testiramo uspesno preuzimanje svih rezervacija za korisnika
    it('treba da vrati sve rezervacije za korisnika iz x-user-id header-a', () => {
      return request(app.getHttpServer())
        .get('/bookings')
        .set('x-user-id', 'user-123')
        .expect(200) // HTTP 200 OK
        .expect((res) => {
          // Proveravamo da odgovor sadrzi niz sa jednom rezervacijom
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(1);
          expect(res.body[0].userId).toBe('user-123');
        });
    });

    // Testiramo da se repozitorijum poziva sa ispravnim userId parametrom
    it('treba da pozove repozitorijum sa ispravnim userId-em', async () => {
      await request(app.getHttpServer())
        .get('/bookings')
        .set('x-user-id', 'user-123')
        .expect(200);

      // Proveravamo da je find pozvan sa odgovarajucim filtrom
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        order: { date: 'ASC', startTime: 'ASC' },
      });
    });

    // Testiramo da zahtev bez x-user-id header-a vraca 401
    it('treba da vrati 401 ako nedostaje x-user-id header', () => {
      return request(app.getHttpServer())
        .get('/bookings')
        .expect(401);
    });
  });

  // ===================================================================
  // Testovi za DELETE /bookings/:id - Otkazivanje rezervacije
  // ===================================================================

  describe('DELETE /bookings/:id', () => {
    // Testiramo uspesno otkazivanje rezervacije
    it('treba da otkaze rezervaciju i vrati azurirane podatke', () => {
      // Moramo vratiti svez objekat jer cancel metoda mutira status direktno na objektu
      mockRepository.findOne.mockResolvedValueOnce({ ...mockBooking, status: 'active' });
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };
      mockRepository.save.mockResolvedValueOnce(cancelledBooking);

      return request(app.getHttpServer())
        .delete(`/bookings/${mockBooking.id}`)
        .set('x-user-id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('cancelled');
        });
    });

    // Testiramo da se RabbitMQ poruka salje nakon otkazivanja
    it('treba da emituje booking_cancelled dogadjaj na RabbitMQ', async () => {
      // Moramo vratiti svez objekat sa statusom 'active' jer cancel metoda menja status direktno
      mockRepository.findOne.mockResolvedValueOnce({ ...mockBooking, status: 'active' });
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };
      mockRepository.save.mockResolvedValueOnce(cancelledBooking);

      await request(app.getHttpServer())
        .delete(`/bookings/${mockBooking.id}`)
        .set('x-user-id', 'user-123')
        .expect(200);

      expect(mockRabbitMQClient.emit).toHaveBeenCalledWith(
        'booking_cancelled',
        expect.objectContaining({
          userId: 'user-123',
          roomId: 'room-456',
        }),
      );
    });

    // Testiramo da zahtev bez x-user-id header-a vraca 401
    it('treba da vrati 401 ako nedostaje x-user-id header', () => {
      return request(app.getHttpServer())
        .delete(`/bookings/${mockBooking.id}`)
        .expect(401);
    });

    // Testiramo da korisnik ne moze otkazati tudju rezervaciju
    it('treba da vrati 400 ako korisnik pokusava da otkaze tudju rezervaciju', () => {
      return request(app.getHttpServer())
        .delete(`/bookings/${mockBooking.id}`)
        .set('x-user-id', 'drugi-korisnik') // Nije vlasnik rezervacije
        .expect(400);
    });

    // Testiramo da se ne moze dva puta otkazati ista rezervacija
    it('treba da vrati 400 ako je rezervacija vec otkazana', () => {
      // Simuliramo da je rezervacija vec otkazana
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockBooking,
        status: 'cancelled',
      });

      return request(app.getHttpServer())
        .delete(`/bookings/${mockBooking.id}`)
        .set('x-user-id', 'user-123')
        .expect(400);
    });

    // Testiramo da se vraca 404 ako rezervacija ne postoji
    it('treba da vrati 404 ako rezervacija ne postoji', () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .delete('/bookings/nepostojeci-id')
        .set('x-user-id', 'user-123')
        .expect(404);
    });
  });

  // ===================================================================
  // Testovi za GET /bookings/room/:roomId - Rezervacije za sobu
  // ===================================================================

  describe('GET /bookings/room/:roomId', () => {
    // Testiramo preuzimanje rezervacija za odredjenu sobu na odredjeni datum
    it('treba da vrati sve aktivne rezervacije za sobu na dati datum', () => {
      return request(app.getHttpServer())
        .get('/bookings/room/room-456?date=2026-03-01')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(1);
          expect(res.body[0].roomId).toBe('room-456');
        });
    });

    // Testiramo da repozitorijum prima ispravne parametre za pretragu
    it('treba da pozove repozitorijum sa ispravnim roomId i datumom', async () => {
      await request(app.getHttpServer())
        .get('/bookings/room/room-456?date=2026-03-01')
        .expect(200);

      // Proveravamo da je find pozvan sa filterom za sobu, datum i status
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { roomId: 'room-456', date: '2026-03-01', status: 'active' },
        order: { startTime: 'ASC' },
      });
    });

    // Testiramo da ruta radi i bez date query parametra (vraca sve za sobu)
    it('treba da radi i bez date query parametra', () => {
      return request(app.getHttpServer())
        .get('/bookings/room/room-456')
        .expect(200);
    });

    // Testiramo da vraca prazan niz kada nema rezervacija za sobu
    it('treba da vrati prazan niz kada nema rezervacija za tu sobu', () => {
      mockRepository.find.mockResolvedValueOnce([]);

      return request(app.getHttpServer())
        .get('/bookings/room/room-456?date=2026-03-01')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(0);
        });
    });
  });
});
