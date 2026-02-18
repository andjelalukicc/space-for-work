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
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable() // NestJS dekorator - oznacava da se ovaj servis moze "injektovati" u druge klase
export class UsersService {
  constructor(
    @InjectRepository(User) // Injektuje TypeORM repozitorijum za User tabelu
    private usersRepository: Repository<User>, // Omogucava CRUD operacije nad bazom
  ) {}

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
    const { password, ...result } = saved;
    return result;
  }

  /**
   * VALIDACIJA PRI LOGINU
   * Proverava da li se unesena lozinka poklapa sa hash-om u bazi.
   * bcrypt.compare() poredi plaintext lozinku sa hash-om.
   * Vraca korisnika ako je uspesno, null ako nije.
   */
  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    // bcrypt.compare poredi unesenu lozinku sa hash-om iz baze
    if (user && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null; // Pogresan email ili lozinka
  }

  /**
   * PRETRAGA PO ID-u
   * Vraca korisnika bez lozinke. Koristi se za /profile endpoint.
   */
  async findById(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { password, ...result } = user;
    return result;
  }

  /**
   * PRETRAGA PO EMAIL-u
   * Koristi se interno za provere.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }
}
