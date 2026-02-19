/**
 * UNIT TESTOVI ZA USERS SERVICE
 *
 * Testiramo biznis logiku Users servisa bez prave baze podataka.
 * Koristimo "mock" (lazni) repozitorijum koji simulira ponasanje baze.
 *
 * Sta testiramo:
 * - Uspesna registracija novog korisnika
 * - Registracija sa vec postojecim email-om (treba da baci gresku)
 * - Uspesna validacija korisnika pri loginu
 * - Neuspesna validacija (pogresan password)
 * - Pretraga korisnika po ID-u
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

// Mock repozitorijum - simulira bazu podataka u memoriji
const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    // Kreiranje test modula sa mock zavisnostima
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User), // Umesto prave baze, koristimo mock
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Resetujemo sve mock-ove pre svakog testa
    jest.clearAllMocks();
  });

  // ==================== REGISTER TESTOVI ====================

  describe('register', () => {
    it('treba uspesno da registruje novog korisnika', async () => {
      // Priprema: email ne postoji u bazi
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        id: 'test-uuid',
        name: 'Test User',
        email: 'test@test.com',
        password: 'hashedPassword',
        role: 'member',
      });
      mockRepository.save.mockResolvedValue({
        id: 'test-uuid',
        name: 'Test User',
        email: 'test@test.com',
        password: 'hashedPassword',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Akcija: pozivamo register
      const result = await service.register({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
      });

      // Provera: rezultat ne sadrzi lozinku
      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
      expect(result.name).toBe('Test User');
      expect((result as any).password).toBeUndefined();
    });

    it('treba da baci ConflictException ako email vec postoji', async () => {
      // Priprema: email VEC postoji u bazi
      mockRepository.findOne.mockResolvedValue({
        id: 'existing-uuid',
        email: 'test@test.com',
      });

      // Akcija i provera: ocekujemo gresku
      await expect(
        service.register({
          name: 'Test User',
          email: 'test@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==================== VALIDATE USER TESTOVI ====================

  describe('validateUser', () => {
    it('treba da vrati korisnika ako su email i lozinka ispravni', async () => {
      // Priprema: hashujemo lozinku kao sto bi servis uradio
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockRepository.findOne.mockResolvedValue({
        id: 'test-uuid',
        email: 'test@test.com',
        password: hashedPassword,
        name: 'Test User',
        role: 'member',
      });

      // Akcija
      const result = await service.validateUser('test@test.com', 'password123');

      // Provera: korisnik je pronadjen
      expect(result).toBeDefined();
      expect(result.email).toBe('test@test.com');
    });

    it('treba da vrati null ako je lozinka pogresna', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockRepository.findOne.mockResolvedValue({
        id: 'test-uuid',
        email: 'test@test.com',
        password: hashedPassword,
      });

      // Akcija: saljemo pogresnu lozinku
      const result = await service.validateUser('test@test.com', 'pogresna');

      // Provera: vraca null
      expect(result).toBeNull();
    });

    it('treba da vrati null ako korisnik ne postoji', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nepostoji@test.com', 'pass');

      expect(result).toBeNull();
    });
  });

  // ==================== FIND BY ID TESTOVI ====================

  describe('findById', () => {
    it('treba da vrati korisnika bez lozinke', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: 'test-uuid',
        name: 'Test User',
        email: 'test@test.com',
        password: 'hashedPassword',
        role: 'member',
      });

      const result = await service.findById('test-uuid');

      expect(result.email).toBe('test@test.com');
      expect((result as any).password).toBeUndefined();
    });

    it('treba da baci UnauthorizedException ako korisnik ne postoji', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nepostoji')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
