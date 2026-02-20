/**
 * ===================================================================
 * E2E TESTOVI ZA USER SERVICE
 * ===================================================================
 *
 * Ovi testovi proveravaju rad kontrolera za korisnike (UsersController)
 * koristeci NestJS Testing modul sa mock repozitorijumom.
 * Ne koristi se prava baza podataka - svi podaci su simulirani.
 *
 * Testiramo sledece rute:
 *   POST /users/register  - Registracija novog korisnika
 *   POST /users/login     - Login korisnika (vraca JWT token)
 *   GET  /users/profile   - Profil ulogovanog korisnika (zasticeno JWT-om)
 *   GET  /users/:id       - Preuzimanje korisnika po ID-u
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/user.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

// Tajni kljuc za potpisivanje JWT tokena u testovima
const JWT_SECRET = 'coworking-secret-key';

// Primer podataka korisnika za testiranje
const mockUser: User = {
  id: 'user-uuid-123',
  name: 'Marko Markovic',
  email: 'marko@example.com',
  password: '', // Bice postavljen u beforeAll nakon hashovanja
  role: 'member',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

// Mock repozitorijum - zamenjuje pravi TypeORM repozitorijum u testovima
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let hashedPassword: string;

  // Pre svih testova - hashujemo lozinku jednom jer je bcrypt spor
  beforeAll(async () => {
    hashedPassword = await bcrypt.hash('sifra123', 10);
    mockUser.password = hashedPassword;
  });

  // Pre svakog testa kreiramo novu NestJS aplikaciju sa mock zavisnostima
  beforeEach(async () => {
    jest.clearAllMocks();

    // Postavljamo podrazumevane povratne vrednosti za mock repozitorijum
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockImplementation((dto) => ({ ...mockUser, ...dto }));
    mockRepository.save.mockImplementation((entity) =>
      Promise.resolve({ ...mockUser, ...entity }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // ConfigModule za citanje konfiguracije (JWT_SECRET)
        ConfigModule.forRoot({
          isGlobal: true,
          // Postavljamo JWT_SECRET za testove
          load: [() => ({ JWT_SECRET })],
        }),
        // PassportModule za autentifikaciju
        PassportModule,
        // JwtModule za kreiranje i verifikaciju tokena
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '24h' },
        }),
      ],
      controllers: [UsersController],
      providers: [
        UsersService,
        JwtStrategy, // JWT strategija za zastitu ruta
        // Zamenjujemo pravi TypeORM repozitorijum sa mock-om
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Ukljucujemo ValidationPipe da bi DTO validacija radila u testovima
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Dobijamo JwtService instancu za generisanje tokena u testovima
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  // Nakon svakog testa gasimo aplikaciju
  afterEach(async () => {
    await app.close();
  });

  // ===================================================================
  // Testovi za POST /users/register - Registracija korisnika
  // ===================================================================

  describe('POST /users/register', () => {
    // Testiramo uspesnu registraciju sa validnim podacima
    it('treba da registruje novog korisnika sa validnim podacima', () => {
      // Simuliramo da email ne postoji u bazi (findOne vraca null)
      mockRepository.findOne.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .post('/users/register')
        .send({
          name: 'Marko Markovic',
          email: 'marko@example.com',
          password: 'sifra123',
        })
        .expect(201) // HTTP 201 Created
        .expect((res) => {
          // Proveravamo da odgovor sadrzi poruku o uspehu i podatke korisnika
          expect(res.body.message).toBe('User registered successfully');
          expect(res.body.user).toBeDefined();
          expect(res.body.user.email).toBe('marko@example.com');
          // Proveravamo da lozinka NIJE ukljucena u odgovor (bezbednost)
          expect(res.body.user.password).toBeUndefined();
        });
    });

    // Testiramo da registracija ne prolazi ako email vec postoji
    it('treba da vrati 409 ako email vec postoji u bazi', () => {
      // Simuliramo da email vec postoji u bazi
      mockRepository.findOne.mockResolvedValueOnce(mockUser);

      return request(app.getHttpServer())
        .post('/users/register')
        .send({
          name: 'Marko Markovic',
          email: 'marko@example.com',
          password: 'sifra123',
        })
        .expect(409); // Conflict - email je vec registrovan
    });

    // Testiramo da ValidationPipe odbija nevalidan email format
    it('treba da vrati 400 za nevalidan email format', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send({
          name: 'Marko',
          email: 'nevalidan-email', // Nije validan email format
          password: 'sifra123',
        })
        .expect(400); // Bad Request - validacija ne prolazi
    });

    // Testiramo da ValidationPipe odbija prekratku lozinku
    it('treba da vrati 400 za lozinku kracu od 6 karaktera', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send({
          name: 'Marko',
          email: 'marko@example.com',
          password: '123', // Prekratka - minimum je 6 karaktera
        })
        .expect(400);
    });

    // Testiramo da ValidationPipe odbija zahtev bez obaveznih polja
    it('treba da vrati 400 ako nedostaje obavezno polje (name)', () => {
      return request(app.getHttpServer())
        .post('/users/register')
        .send({
          email: 'marko@example.com',
          password: 'sifra123',
          // name nedostaje
        })
        .expect(400);
    });
  });

  // ===================================================================
  // Testovi za POST /users/login - Login korisnika
  // ===================================================================

  describe('POST /users/login', () => {
    // Testiramo uspesan login sa ispravnim podacima
    it('treba da vrati JWT token za ispravne kredencijale', () => {
      // Simuliramo da korisnik postoji u bazi sa hashovanom lozinkom
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        password: hashedPassword,
      });

      return request(app.getHttpServer())
        .post('/users/login')
        .send({
          email: 'marko@example.com',
          password: 'sifra123',
        })
        .expect(201) // NestJS POST rute podrazumevano vracaju 201
        .expect((res) => {
          // Proveravamo da odgovor sadrzi access_token i podatke korisnika
          expect(res.body.access_token).toBeDefined();
          expect(typeof res.body.access_token).toBe('string');
          expect(res.body.user).toBeDefined();
          expect(res.body.user.email).toBe('marko@example.com');
          expect(res.body.user.role).toBe('member');
          // Proveravamo da lozinka NIJE u odgovoru
          expect(res.body.user.password).toBeUndefined();
        });
    });

    // Testiramo da login ne prolazi sa pogresnom lozinkom
    it('treba da vrati 401 za pogresnu lozinku', () => {
      // Simuliramo da korisnik postoji ali lozinka je pogresna
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        password: hashedPassword,
      });

      return request(app.getHttpServer())
        .post('/users/login')
        .send({
          email: 'marko@example.com',
          password: 'pogresna-lozinka', // Pogresna lozinka
        })
        .expect(401); // Unauthorized - neuspesna autentifikacija
    });

    // Testiramo da login ne prolazi sa nepostojecim email-om
    it('treba da vrati 401 za nepostojeci email', () => {
      // findOne vraca null - korisnik ne postoji
      mockRepository.findOne.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .post('/users/login')
        .send({
          email: 'nepostoji@example.com',
          password: 'sifra123',
        })
        .expect(401);
    });

    // Testiramo da ValidationPipe odbija nevalidan email u login zahtevu
    it('treba da vrati 400 za nevalidan email format pri loginu', () => {
      return request(app.getHttpServer())
        .post('/users/login')
        .send({
          email: 'nevalidan-email',
          password: 'sifra123',
        })
        .expect(400);
    });
  });

  // ===================================================================
  // Testovi za GET /users/profile - Profil ulogovanog korisnika
  // ===================================================================

  describe('GET /users/profile', () => {
    // Testiramo da zasticena ruta vraca profil za validan JWT token
    it('treba da vrati profil korisnika za validan JWT token', () => {
      // Kreiramo validan JWT token za testiranje
      const token = jwtService.sign({
        sub: 'user-uuid-123',
        email: 'marko@example.com',
        role: 'member',
      });

      // Simuliramo da korisnik postoji u bazi
      mockRepository.findOne.mockResolvedValueOnce(mockUser);

      return request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${token}`) // Postavljamo JWT u Authorization header
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('user-uuid-123');
          expect(res.body.email).toBe('marko@example.com');
          expect(res.body.name).toBe('Marko Markovic');
          // Proveravamo da lozinka nije ukljucena u odgovor
          expect(res.body.password).toBeUndefined();
        });
    });

    // Testiramo da ruta vraca 401 ako JWT token nedostaje
    it('treba da vrati 401 ako JWT token nedostaje', () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .expect(401); // Neautorizovan - nema tokena
    });

    // Testiramo da ruta vraca 401 za nevalidan JWT token
    it('treba da vrati 401 za nevalidan JWT token', () => {
      return request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer nevalidan-token-12345')
        .expect(401);
    });
  });

  // ===================================================================
  // Testovi za GET /users/:id - Preuzimanje korisnika po ID-u
  // ===================================================================

  describe('GET /users/:id', () => {
    // Testiramo uspesno preuzimanje korisnika po ID-u
    it('treba da vrati korisnika kada ID postoji u bazi', () => {
      // Simuliramo da korisnik postoji u bazi
      mockRepository.findOne.mockResolvedValueOnce(mockUser);

      return request(app.getHttpServer())
        .get('/users/user-uuid-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('user-uuid-123');
          expect(res.body.name).toBe('Marko Markovic');
          expect(res.body.email).toBe('marko@example.com');
          // Lozinka ne sme biti u odgovoru
          expect(res.body.password).toBeUndefined();
        });
    });

    // Testiramo da se vraca 401 (Unauthorized) za nepostojeci ID
    // (UsersService baca UnauthorizedException za nepostojece korisnike)
    it('treba da vrati 401 ako korisnik ne postoji u bazi', () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .get('/users/nepostojeci-id')
        .expect(401); // UsersService baca UnauthorizedException
    });
  });
});
