/**
 * ===================================================================
 * BOOKING ENTITY - Model rezervacije (tabela "bookings" u bazi podataka)
 * ===================================================================
 *
 * Ova klasa predstavlja entitet rezervacije u sistemu za bukiranje coworking prostora.
 * Koristi TypeORM dekoratore da mapira klasu na tabelu "bookings" u PostgreSQL bazi.
 *
 * Svaki red u tabeli predstavlja jednu rezervaciju koju je korisnik napravio
 * za odredjenu sobu, na odredjeni datum, u odredjenom vremenskom intervalu.
 *
 * TypeORM na osnovu ove klase automatski kreira/azurira strukturu tabele u bazi
 * (ako je sinhronizacija ukljucena u konfiguraciji).
 */

// Uvoz TypeORM dekoratora koji se koriste za definisanje strukture tabele
import {
  Entity, // Dekorator koji oznacava klasu kao entitet (tabelu u bazi)
  PrimaryGeneratedColumn, // Dekorator za primarni kljuc koji se automatski generise
  Column, // Dekorator za obicnu kolonu u tabeli
  CreateDateColumn, // Dekorator za kolonu koja automatski cuva datum kreiranja zapisa
} from 'typeorm';

/**
 * @Entity('bookings') - Ovaj dekorator govori TypeORM-u da ova klasa
 * odgovara tabeli koja se zove "bookings" u bazi podataka.
 * Bez ovog dekoratora, TypeORM ne bi znao da treba da kreira tabelu.
 */
@Entity('bookings')
export class Booking {
  /**
   * Primarni kljuc rezervacije - UUID format (npr. "550e8400-e29b-41d4-a716-446655440000").
   * UUID se automatski generise pri kreiranju novog zapisa.
   * Koristimo UUID umesto auto-increment broja jer je bezbedniji u distribuiranim sistemima
   * (svaki mikroservis moze nezavisno da generise jedinstven ID).
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * ID korisnika koji je napravio rezervaciju.
   * Ovo je UUID korisnika iz auth-service-a. Ne koristimo foreign key jer su
   * servisi razdvojeni (mikroservisna arhitektura) - svaki servis ima svoju bazu.
   */
  @Column()
  userId: string;

  /**
   * ID sobe koja je rezervisana.
   * Ovo je UUID sobe iz room-service-a. Isto kao userId, nema foreign key
   * jer je room-service zaseban mikroservis sa svojom bazom.
   */
  @Column()
  roomId: string;

  /**
   * Datum rezervacije u formatu YYYY-MM-DD (npr. "2026-02-18").
   * Tip kolone je 'date' sto znaci da PostgreSQL cuva samo datum bez vremena.
   * Koristimo string tip u TypeScript-u jer je lakse za poredjenje i validaciju.
   */
  @Column('date')
  date: string; // YYYY-MM-DD

  /**
   * Vreme pocetka rezervacije u formatu HH:MM (npr. "09:00", "14:30").
   * Tip kolone je 'time' sto znaci da PostgreSQL cuva samo vreme bez datuma.
   * Vreme mora biti u intervalima od 30 minuta (09:00, 09:30, 10:00...).
   */
  @Column('time')
  startTime: string; // HH:MM

  /**
   * Vreme zavrsetka rezervacije u formatu HH:MM (npr. "10:00", "15:30").
   * Mora biti posle startTime i takodje u intervalima od 30 minuta.
   * Minimalno trajanje rezervacije je 30 minuta.
   */
  @Column('time')
  endTime: string; // HH:MM

  /**
   * Status rezervacije - moze biti 'active' ili 'cancelled'.
   * Podrazumevana vrednost je 'active' (nova rezervacija je uvek aktivna).
   * Kada korisnik otkaze rezervaciju, status se menja u 'cancelled'.
   * Ne brisemo zapis iz baze vec samo menjamo status - ovo je "soft delete" pristup
   * koji omogucava cuvanje istorije svih rezervacija.
   */
  @Column({ default: 'active' })
  status: string; // 'active' | 'cancelled'

  /**
   * Datum i vreme kreiranja zapisa u bazi.
   * @CreateDateColumn automatski postavlja trenutni timestamp kada se zapis sacuva prvi put.
   * Korisno za pracenje kada je rezervacija napravljena.
   */
  @CreateDateColumn()
  createdAt: Date;
}
