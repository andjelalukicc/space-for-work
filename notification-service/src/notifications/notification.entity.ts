// ============================================================================
// NOTIFICATION ENTITY - Definicija entiteta (tabele) za notifikacije
// ============================================================================
// Ovaj fajl definise strukturu tabele "notifications" u bazi podataka.
// Koristi TypeORM dekoratore da mapira TypeScript klasu na SQL tabelu.
// Svaka instanca klase Notification predstavlja jedan red u tabeli.
// ============================================================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// @Entity('notifications') - ovaj dekorator kaze TypeORM-u da ova klasa
// odgovara tabeli koja se zove "notifications" u bazi podataka.
// TypeORM ce automatski kreirati ovu tabelu ako koristimo synchronize: true.
@Entity('notifications')
export class Notification {
  // @PrimaryGeneratedColumn('uuid') - primarni kljuc tabele.
  // Koristi UUID format (npr. "550e8400-e29b-41d4-a716-446655440000")
  // umesto auto-increment broja. UUID je bolji za distribuirane sisteme
  // jer se moze generisati nezavisno na razlicitim servisima bez konflikta.
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // userId - ID korisnika kome je notifikacija namenjena.
  // Ovo polje povezuje notifikaciju sa korisnikom iz User servisa.
  // Nije foreign key jer se korisnici nalaze u drugoj bazi (mikroservisna arhitektura).
  @Column()
  userId: string;

  // type - tip notifikacije, npr. 'booking_created' ili 'booking_cancelled'.
  // Koristi se da bi frontend mogao da razlikuje vrste notifikacija
  // i da ih prikaze na odgovarajuci nacin (ikonica, boja, itd.).
  @Column()
  type: string; // 'booking_created' | 'booking_cancelled'

  // message - tekst poruke notifikacije koji se prikazuje korisniku.
  // Npr. "Booking confirmed: 2024-01-15 from 09:00 to 11:00"
  @Column()
  message: string;

  // isRead - da li je korisnik procitao notifikaciju.
  // Podrazumevana vrednost je false (nova notifikacija je neprocitana).
  // Kada korisnik otvori/klikne notifikaciju, ovo se postavlja na true.
  @Column({ default: false })
  isRead: boolean;

  // @CreateDateColumn() - specijalan TypeORM dekorator koji automatski
  // postavlja datum i vreme kada je red kreiran u bazi.
  // Ne moramo rucno da postavljamo ovu vrednost - TypeORM to radi za nas.
  @CreateDateColumn()
  createdAt: Date;
}
