/**
 * Rooms Service - Servisni sloj koji sadrzi poslovnu logiku za upravljanje prostorijama.
 *
 * Ovaj servis je odgovoran za:
 * 1. Automatsko kreiranje pocetnih podataka (seed) - 2 sale za sastanke i 6 telefonskih kabina
 * 2. Pronalazenje prostorija po razlicitim kriterijumima (sve, po ID-u, po tipu)
 * 3. Reaktivnu komunikaciju putem RxJS Subject-a - emitovanje promena dostupnosti prostorija
 *
 * Servis implementira OnModuleInit interfejs sto znaci da se seedRooms() metoda
 * automatski poziva kada se modul inicijalizuje (pri pokretanju aplikacije).
 *
 * RxJS Subject se koristi za Server-Sent Events (SSE) - reaktivni pattern koji omogucava
 * serveru da salje azuriranja klijentima u realnom vremenu bez da klijent stalno salje zahteve.
 * Ovo je zahtev specifikacije projekta za reaktivnu komunikaciju.
 */

import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';
// Subject iz RxJS biblioteke - omogucava reaktivno programiranje
// Subject je istovremeno i Observable (moze se slusati) i Observer (moze emitovati vrednosti)
// Koristimo ga za implementaciju SSE (Server-Sent Events) paterna
import { Subject } from 'rxjs';

// @Injectable() - dekorator koji oznacava da NestJS moze upravljati zivotnim ciklusom ove klase
// i injektovati je kao zavisnost (dependency injection) gde god je potrebna
@Injectable()
export class RoomsService implements OnModuleInit {
  // RxJS Subject koji sluzi kao kanal za emitovanje dogadjaja o promeni dostupnosti prostorija
  // Kada se dostupnost prostorije promeni (npr. neko rezervise ili otkaze rezervaciju),
  // emitujemo dogadjaj kroz ovaj Subject, a svi pretplaceni klijenti dobijaju obavestenje
  // Ovo je kljucni deo reaktivne komunikacije u sistemu
  private availabilitySubject = new Subject<{
    roomId: string;
    event: string;
  }>();

  // Konstruktor sa dependency injection - TypeORM repozitorijum za Room entitet
  // @InjectRepository(Room) - NestJS dekorator koji injektuje TypeORM repozitorijum
  // Repository<Room> pruza metode za CRUD operacije nad tabelom 'rooms' u bazi
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  // OnModuleInit lifecycle hook - poziva se automatski kada se modul inicijalizuje
  // Koristimo ga da pokrenemo seed funkciju pri startu aplikacije
  async onModuleInit() {
    await this.seedRooms();
  }

  /**
   * Seed funkcija - automatsko kreiranje pocetnih podataka u bazi.
   *
   * Ova metoda se poziva prilikom svakog pokretanja aplikacije, ali kreira podatke
   * SAMO ako je tabela prazna (count === 0). Na taj nacin se izbegava dupliranje podataka.
   *
   * Kreira ukupno 8 prostorija prema specifikaciji coworking prostora:
   * - 2 sale za sastanke (Meeting Room Small sa kapacitetom 8, Meeting Room Large sa kapacitetom 20)
   *   - Obe imaju Smart TV i Whiteboard kao opremu
   * - 6 telefonskih kabina (Phone Booth 1-6, svaka sa kapacitetom 1)
   *   - Telefonske kabine nemaju dodatnu opremu
   *
   * Ovo je "private" metoda - moze se pozvati samo unutar ovog servisa,
   * jer je seed logika interna stvar servisa i ne treba da bude dostupna spolja.
   */
  private async seedRooms() {
    // Proveravamo da li vec postoje podaci u tabeli
    const count = await this.roomsRepository.count();
    // Ako postoje podaci, preskacemo seed - ne zelimo duplikate
    if (count > 0) return;

    // Definisemo niz prostorija koje treba kreirati
    // Svaki objekat odgovara strukturi Room entiteta (bez id-a i createdAt jer se auto-generisu)
    const rooms = [
      {
        name: 'Meeting Room Small',
        type: 'meeting_room',
        capacity: 8,
        amenities: ['Smart TV', 'Whiteboard'],
      },
      {
        name: 'Meeting Room Large',
        type: 'meeting_room',
        capacity: 20,
        amenities: ['Smart TV', 'Whiteboard'],
      },
      {
        name: 'Phone Booth 1',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
      {
        name: 'Phone Booth 2',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
      {
        name: 'Phone Booth 3',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
      {
        name: 'Phone Booth 4',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
      {
        name: 'Phone Booth 5',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
      {
        name: 'Phone Booth 6',
        type: 'phone_booth',
        capacity: 1,
        amenities: [],
      },
    ];

    // Iteriramo kroz niz i svaku prostoriju cuvamo u bazu
    // create() kreira instancu entiteta u memoriji, save() je cuva u bazu podataka
    for (const room of rooms) {
      const entity = this.roomsRepository.create(room);
      await this.roomsRepository.save(entity);
    }

    // Logujemo poruku u konzolu kao potvrdu uspesnog seed-ovanja
    console.log('Seeded 8 rooms (2 meeting rooms + 6 phone booths)');
  }

  /**
   * Pronalazi sve aktivne prostorije u bazi podataka.
   * Vraca samo prostorije gde je isActive === true (filtriramo neaktivne/obrisane).
   * Koristi se za prikaz svih dostupnih prostorija na klijentskoj strani.
   */
  async findAll(): Promise<Room[]> {
    return this.roomsRepository.find({ where: { isActive: true } });
  }

  /**
   * Pronalazi jednu prostoriju po njenom UUID identifikatoru.
   * Ako prostorija sa datim ID-om ne postoji, baca NotFoundException (HTTP 404 greska).
   * Koristi se kada klijent trazi detalje o konkretnoj prostoriji.
   */
  async findById(id: string): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  /**
   * Pronalazi sve aktivne prostorije odredjenog tipa.
   * Tip moze biti 'meeting_room' ili 'phone_booth'.
   * Koristi se za filtriranje prostorija - npr. korisnik zeli da vidi samo telefonske kabine.
   */
  async findByType(type: string): Promise<Room[]> {
    return this.roomsRepository.find({ where: { type, isActive: true } });
  }

  /**
   * Emituje dogadjaj o promeni dostupnosti prostorije kroz RxJS Subject.
   * Ova metoda se poziva iz drugih servisa (npr. booking-service) kada se
   * kreira ili otkaze rezervacija, kako bi svi pretplaceni klijenti bili obavesteni.
   *
   * Subject.next() salje novu vrednost svim pretplatnicima (observerima).
   * Ovo je "push" model komunikacije - server aktivno salje podatke klijentima.
   */
  emitAvailabilityChange(roomId: string, event: string) {
    this.availabilitySubject.next({ roomId, event });
  }

  /**
   * Vraca Observable stream za pracenje promena dostupnosti prostorija.
   * asObservable() pretvara Subject u Observable - klijenti mogu samo da slusaju (citaju),
   * ali ne mogu da emituju (pisu) nove vrednosti, sto obezbejduje enkapsulaciju.
   *
   * Ovaj stream se koristi u kontroleru za SSE endpoint koji klijenti slusaju.
   */
  getAvailabilityStream() {
    return this.availabilitySubject.asObservable();
  }
}
