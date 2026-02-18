/**
 * Room Entity - Model baze podataka za sobe i telefonske kabine u coworking prostoru.
 *
 * Ova klasa predstavlja entitet (tabelu) u bazi podataka koristeci TypeORM biblioteku.
 * Svaka instanca ove klase odgovara jednom redu u tabeli 'rooms'.
 * Entitet definise strukturu podataka - koje kolone postoje, koji su im tipovi,
 * i koja ogranicenja vaze (npr. podrazumevana vrednost, nullable polja itd.).
 *
 * U nasem coworking sistemu postoje dva tipa prostorija:
 * - meeting_room (sala za sastanke) - veci kapacitet, oprema poput Smart TV-a i table
 * - phone_booth (telefonska kabina) - kapacitet 1, za privatne pozive
 */

// Uvozimo dekoratore iz TypeORM biblioteke koji nam omogucavaju da definisemo
// strukturu tabele u bazi podataka koristeci TypeScript klasu
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

// @Entity('rooms') - dekorator koji oznacava da je ova klasa mapirana na tabelu 'rooms' u bazi
// TypeORM ce automatski kreirati ovu tabelu prilikom pokretanja aplikacije (ako je synchronize ukljucen)
@Entity('rooms')
export class Room {
  // Primarni kljuc tabele - automatski generisan UUID (univerzalno jedinstven identifikator)
  // UUID se koristi umesto auto-increment broja jer je pogodniji za distribuirane sisteme
  // i mikroservisnu arhitekturu - ne zavisi od redosleda unosa u bazu
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Naziv prostorije, npr. "Meeting Room Small" ili "Phone Booth 1"
  // Ovo je obavezno polje (nema nullable: true)
  @Column()
  name: string;

  // Tip prostorije - moze biti 'meeting_room' (sala za sastanke) ili 'phone_booth' (telefonska kabina)
  // Cuva se kao obican string u bazi, a validacija tipa se vrsi na aplikativnom nivou
  @Column()
  type: string; // 'meeting_room' | 'phone_booth'

  // Kapacitet prostorije - maksimalan broj osoba koje mogu koristiti prostoriju
  // Za telefonske kabine je uvek 1, za sale za sastanke moze biti 8, 20 itd.
  @Column()
  capacity: number;

  // Lista opreme/pogodnosti u prostoriji, npr. ['Smart TV', 'Whiteboard']
  // 'simple-array' tip cuva niz kao string razdvojen zarezima u bazi (npr. "Smart TV,Whiteboard")
  // nullable: true - polje moze biti prazno (telefonske kabine obicno nemaju dodatnu opremu)
  @Column('simple-array', { nullable: true })
  amenities: string[]; // ['Smart TV', 'Whiteboard']

  // Da li je prostorija aktivna i dostupna za rezervaciju
  // default: true - svaka nova prostorija je podrazumevano aktivna
  // Ovo omogucava "meko brisanje" (soft delete) - umesto brisanja iz baze, samo se deaktivira
  @Column({ default: true })
  isActive: boolean;

  // Datum i vreme kreiranja zapisa - automatski se popunjava prilikom prvog cuvanja u bazu
  // @CreateDateColumn je specijalan TypeORM dekorator koji automatski postavlja trenutni timestamp
  @CreateDateColumn()
  createdAt: Date;
}
