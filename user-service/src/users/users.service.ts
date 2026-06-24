/**
 * USERS SERVICE - Biznis logika za korisnike
 *
 * Ovaj fajl sadrzi svu logiku vezanu za korisnike:
 * - Registracija novog korisnika (sa hashovanom lozinkom)
 * - Validacija pri loginu (provera email + lozinka)
 * - Pretraga korisnika po ID-u ili email-u
 *
 * Controller (users.controller.ts) prima HTTP zahtev i prosledjuje ga ovde.
 */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable() // NestJS dekorator - oznacava da se ovaj servis moze "injektovati" u druge klase
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User) // Injektuje TypeORM repozitorijum za User tabelu
    private usersRepository: Repository<User>, // Omogucava CRUD operacije nad bazom
  ) {}

  async onModuleInit() {
    await this.ensureSeedDemoAccounts();
  }

  /**
   * Demo admin i clan za portal (isti kao Space For Work demo dugmad).
   * Prepisi env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_MEMBER_EMAIL, SEED_MEMBER_PASSWORD.
   */
  private async ensureSeedDemoAccounts() {
    const seeds = [
      {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@spaceforwork.rs',
        password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
        name: 'Admin Demo',
        role: 'admin',
      },
      {
        email: process.env.SEED_MEMBER_EMAIL || 'korisnik@spaceforwork.rs',
        password: process.env.SEED_MEMBER_PASSWORD || 'korisnik123',
        name: 'Korisnik Demo',
        role: 'member',
      },
    ];
    for (const s of seeds) {
      const existing = await this.usersRepository.findOne({
        where: { email: s.email },
      });
      if (existing) continue;
      const hashedPassword = await bcrypt.hash(s.password, 10);
      await this.usersRepository.save(
        this.usersRepository.create({
          name: s.name,
          email: s.email,
          password: hashedPassword,
          role: s.role,
        }),
      );
      console.log(`Seeded user: ${s.email} (${s.role})`);
    }
  }

  /**
   * REGISTRACIJA NOVOG KORISNIKA
   * 1. Proveri da li email vec postoji
   * 2. Hashuj lozinku sa bcrypt-om
   * 3. Sacuvaj u bazu
   * 4. Vrati podatke BEZ lozinke
   */
  async register(registerDto: RegisterDto): Promise<Omit<User, 'password'>> {
    // Proveri da li vec postoji korisnik sa ovim email-om
    const existing = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
      // Vraca HTTP 409 - email je zauzet
    }

    // Hashuj lozinku - "10" je broj salt rundi (vise = sigurnije ali sporije)
    // bcrypt pretvara npr "mojaSifra123" u "$2b$10$X7.2kFh..."
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Kreiraj novog korisnika u bazi sa hashovanom lozinkom
    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    const saved = await this.usersRepository.save(user);

    // Ukloni lozinku iz odgovora - NIKAD ne saljemo hash nazad klijentu
    const { password: _password, ...result } = saved;
    return result;
  }

  /**
   * VALIDACIJA PRI LOGINU
   * Proverava da li se unesena lozinka poklapa sa hash-om u bazi.
   * bcrypt.compare() poredi plaintext lozinku sa hash-om.
   * Vraca korisnika ako je uspesno, null ako nije.
   */
  async validateUser(email: string, pass: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: normalized })
      .getOne();

    // bcrypt.compare poredi unesenu lozinku sa hash-om iz baze
    if (
      user &&
      user.isActive !== false &&
      (await bcrypt.compare(pass, user.password))
    ) {
      return user;
    }
    return null; // Pogresan email ili lozinka ili nalog deaktiviran
  }

  /**
   * PRETRAGA PO ID-u
   * Vraca korisnika bez lozinke. Koristi se za /profile endpoint.
   */
  async findById(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user || user.isActive === false) {
      throw new UnauthorizedException('User not found');
    }
    const { password: _password, ...result } = user;
    return result;
  }

  async adminFindPaginated(query: AdminQueryUsersDto): Promise<{
    data: Omit<User, 'password'>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const qb = this.usersRepository.createQueryBuilder('u');
    if (query.search?.trim()) {
      qb.andWhere(
        '(u.name ILIKE :s OR u.email ILIKE :s OR u.role ILIKE :s)',
        { s: `%${query.search.trim()}%` },
      );
    }
    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [rows, total] = await qb.getManyAndCount();
    const data = rows.map(({ password: _p, ...rest }) => rest);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async adminUpdateUser(
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    await this.usersRepository.save(user);
    const { password: _password, ...result } = user;
    return result;
  }

  async adminDeactivate(id: string): Promise<void> {
    await this.adminUpdateUser(id, { isActive: false });
  }

  /**
   * PRETRAGA PO EMAIL-u
   * Koristi se interno za provere.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }
}
