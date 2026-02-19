/**
 * ===================================================================
 * BOOKINGS SERVICE - Servisni sloj za poslovnu logiku rezervacija
 * ===================================================================
 *
 * Ovo je NAJVAZNIJI fajl u booking-service mikroservisu.
 * Sadrzi svu poslovnu logiku za kreiranje, pretragu i otkazivanje rezervacija.
 *
 * Glavne odgovornosti ovog servisa:
 * 1. Validacija vremenskih intervala (minimum 30 min, intervali od 30 min)
 * 2. Provera ogranicenja (maksimum 3 rezervacije po korisniku dnevno)
 * 3. Detekcija preklapanja rezervacija (za sobu i za korisnika)
 * 4. CRUD operacije nad rezervacijama u bazi podataka
 * 5. Slanje dogadjaja (events) preko RabbitMQ ka notification-service-u
 *
 * Servis koristi Dependency Injection (DI) - NestJS automatski ubacuje
 * zavisnosti (repository i RabbitMQ klijent) kroz konstruktor.
 */

import {
  Injectable, // Dekorator koji oznacava klasu kao servis koji moze da se injektuje
  ConflictException, // HTTP 409 - koristi se kada postoji konflikt (npr. preklapanje rezervacija)
  BadRequestException, // HTTP 400 - koristi se za nevalidne podatke (npr. prekratka rezervacija)
  NotFoundException, // HTTP 404 - koristi se kada rezervacija nije pronadjena
  Inject, // Dekorator za rucno injektovanje zavisnosti po tokenu/imenu
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; // Dekorator za injektovanje TypeORM repozitorijuma
import { Repository } from 'typeorm'; // TypeORM klasa za rad sa bazom podataka
import { ClientProxy } from '@nestjs/microservices'; // Interfejs za komunikaciju sa drugim mikroservisima
import { Booking } from './booking.entity'; // Entitet rezervacije (model tabele)
import { CreateBookingDto } from './dto/create-booking.dto'; // DTO za validaciju ulaznih podataka

/**
 * @Injectable() - Ovaj dekorator govori NestJS-u da ova klasa moze biti
 * injektovana kao zavisnost u druge klase (npr. u BookingsController).
 * Bez ovog dekoratora, Dependency Injection ne bi radio.
 */
@Injectable()
export class BookingsService {
  constructor(
    /**
     * @InjectRepository(Booking) - Injektuje TypeORM repozitorijum za Booking entitet.
     * Repository pruza metode za rad sa bazom: find, save, create, count, createQueryBuilder...
     * NestJS automatski kreira instancu repozitorijuma na osnovu Booking entiteta
     * i povezuje ga sa odgovarajucom tabelom u PostgreSQL bazi.
     */
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,

    /**
     * @Inject('NOTIFICATIONS_SERVICE') - Injektuje RabbitMQ klijent za slanje poruka
     * ka notification-service mikroservisu. Token 'NOTIFICATIONS_SERVICE' se podudara
     * sa konfiguracijom u bookings.module.ts (ClientsModule.registerAsync).
     * Preko ovog klijenta saljemo dogadjaje (events) kada se rezervacija kreira ili otkaze.
     */
    @Inject('NOTIFICATIONS_SERVICE') private notificationsClient: ClientProxy,
  ) {}

  /**
   * ===================================================================
   * CREATE - Kreiranje nove rezervacije
   * ===================================================================
   *
   * Ovo je najkompleksnija metoda u celom servisu. Pre nego sto sacuva
   * rezervaciju, prolazi kroz 5 koraka validacije:
   *
   * 1. Validacija trajanja (minimum 30 minuta)
   * 2. Validacija intervala (vremena moraju biti u koracima od 30 min)
   * 3. Provera dnevnog limita (maks 3 aktivne rezervacije po korisniku)
   * 4. Provera preklapanja za sobu (da li je soba slobodna u tom terminu)
   * 5. Provera preklapanja za korisnika (da li korisnik vec ima rezervaciju u tom terminu)
   *
   * Ako sve validacije prodju, rezervacija se cuva u bazi i salje se
   * 'booking_created' dogadjaj preko RabbitMQ-a.
   *
   * @param userId - ID korisnika koji pravi rezervaciju (dolazi iz x-user-id header-a)
   * @param createBookingDto - DTO sa podacima o rezervaciji (roomId, date, startTime, endTime)
   * @returns Sacuvana rezervacija sa generisanim ID-om
   */
  async create(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<Booking> {
    // Destrukturiranje DTO objekta - vadimo pojedinacna polja radi lakseg rada
    const { roomId, date, startTime, endTime } = createBookingDto;

    // ---------------------------------------------------------------
    // KORAK 1: Validacija vremenskog trajanja rezervacije
    // ---------------------------------------------------------------

    /**
     * Pretvaramo vremena iz string formata (npr. "09:30") u minute (npr. 570)
     * kako bismo mogli da racunamo razliku i proveravamo intervale.
     * Videti helper metodu timeToMinutes() na dnu klase.
     */
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    /**
     * Provera da li je vreme zavrsetka posle vremena pocetka.
     * Npr. startTime="10:00" (600 min) i endTime="09:00" (540 min) - NEVALIDNO
     * jer ne mozes zavrsiti pre nego sto pocnes.
     */
    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }

    /**
     * Provera minimalnog trajanja - rezervacija mora trajati najmanje 30 minuta.
     * Npr. startTime="09:00" (540) i endTime="09:15" (555) => razlika = 15 min < 30 - NEVALIDNO
     * Ovo sprecava besmisleno kratke rezervacije.
     */
    if (end - start < 30) {
      throw new BadRequestException('Minimum booking duration is 30 minutes');
    }

    // ---------------------------------------------------------------
    // KORAK 2: Validacija intervala od 30 minuta
    // ---------------------------------------------------------------

    /**
     * Oba vremena (pocetak i kraj) moraju biti u intervalima od 30 minuta.
     * To znaci da su dozvoljeni samo: 00, 30, 60, 90, 120... minuta.
     *
     * Operator % (modulo) vraca ostatak pri deljenju.
     * Ako je start % 30 !== 0, znaci da vreme nije na punih 30 minuta.
     *
     * Primeri:
     *   "09:00" => 540 min => 540 % 30 = 0 => VALIDNO
     *   "09:30" => 570 min => 570 % 30 = 0 => VALIDNO
     *   "09:15" => 555 min => 555 % 30 = 15 => NEVALIDNO
     *   "09:45" => 585 min => 585 % 30 = 15 => NEVALIDNO
     *
     * Ovo pravilo olaksava upravljanje rasporedom jer su svi termini poravnati.
     */
    if (start % 30 !== 0 || end % 30 !== 0) {
      throw new BadRequestException(
        'Times must be in 30-minute intervals (e.g., 09:00, 09:30, 10:00)',
      );
    }

    // ---------------------------------------------------------------
    // KORAK 3: Provera maksimalnog broja rezervacija po korisniku dnevno
    // ---------------------------------------------------------------

    /**
     * Brojimo koliko aktivnih rezervacija korisnik vec ima na dati datum.
     * Ogranicenje je maksimum 3 aktivne rezervacije po danu.
     * Racunamo samo 'active' rezervacije - otkazane se ne racunaju.
     *
     * Ovo ogranicenje postoji da spreci jednog korisnika da zauzme previse
     * termina i time onemogucava druge korisnike da rezervisu.
     */
    const userBookingsToday = await this.bookingsRepository.count({
      where: { userId, date, status: 'active' },
    });
    if (userBookingsToday >= 3) {
      throw new ConflictException('Maximum 3 active bookings per day reached');
    }

    // ---------------------------------------------------------------
    // KORAK 4: Detekcija preklapanja za sobu (room overlap detection)
    // ---------------------------------------------------------------

    /**
     * KLJUCNA LOGIKA ZA RAZUMEVANJE - Detekcija preklapanja vremenskih intervala
     *
     * Koristimo TypeORM QueryBuilder da napravimo SQL upit koji proverava
     * da li postoji BILO KOJA aktivna rezervacija za istu sobu na isti datum
     * koja se vremenski preklapa sa novom rezervacijom.
     *
     * SQL uslovi za preklapanje:
     *   booking.startTime < :endTime  AND  booking.endTime > :startTime
     *
     * ZASTO OVO RADI - Dva intervala [A_start, A_end] i [B_start, B_end] se preklapaju
     * AKO I SAMO AKO vazi: A_start < B_end AND A_end > B_start
     *
     * Vizuelno objasnjenje (vremenski intervali na vremenskoj liniji):
     *
     * Primer 1 - PREKLAPANJE:
     *   Postojeca:  |----09:00----10:00----|
     *   Nova:            |----09:30----10:30----|
     *   Provera: 09:00 < 10:30? DA  i  10:00 > 09:30? DA => PREKLAPAJU SE
     *
     * Primer 2 - BEZ PREKLAPANJA:
     *   Postojeca:  |----09:00----10:00----|
     *   Nova:                                  |----10:00----11:00----|
     *   Provera: 09:00 < 11:00? DA  i  10:00 > 10:00? NE => NE PREKLAPAJU SE
     *   (tacno nadovezivanje je dozvoljeno jer koristimo striktno ">" a ne ">=")
     *
     * Primer 3 - BEZ PREKLAPANJA:
     *   Postojeca:                    |----11:00----12:00----|
     *   Nova:       |----09:00----10:00----|
     *   Provera: 11:00 < 10:00? NE => NE PREKLAPAJU SE
     *
     * Ovaj algoritam je standardni nacin za detekciju preklapanja intervala u bazama podataka.
     */
    const overlapping = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId }) // Ista soba
      .andWhere('booking.date = :date', { date }) // Isti datum
      .andWhere('booking.status = :status', { status: 'active' }) // Samo aktivne rezervacije
      .andWhere('booking.startTime < :endTime', { endTime }) // Pocetak postojece je PRE kraja nove
      .andWhere('booking.endTime > :startTime', { startTime }) // Kraj postojece je POSLE pocetka nove
      .getCount(); // Brojimo koliko takvih preklapajucih rezervacija postoji

    if (overlapping > 0) {
      throw new ConflictException(
        'This time slot is already booked for this room',
      );
    }

    // ---------------------------------------------------------------
    // KORAK 5: Detekcija preklapanja za korisnika (user overlap detection)
    // ---------------------------------------------------------------

    /**
     * Ista logika kao za sobu, ali ovde proveravamo da li korisnik
     * vec ima rezervaciju u BILO KOJOJ sobi koja se vremenski preklapa.
     *
     * Ovo sprecava korisnika da bude "na dva mesta u isto vreme".
     * Npr. ne mozes imati rezervaciju u Sobi A od 09:00-10:00
     * i istovremeno u Sobi B od 09:30-10:30.
     *
     * SQL logika preklapanja je identicna kao u koraku 4,
     * samo umesto roomId filtriramo po userId.
     */
    const userOverlapping = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.userId = :userId', { userId }) // Isti korisnik
      .andWhere('booking.date = :date', { date }) // Isti datum
      .andWhere('booking.status = :status', { status: 'active' }) // Samo aktivne
      .andWhere('booking.startTime < :endTime', { endTime }) // Preklapanje - pocetak < kraj nove
      .andWhere('booking.endTime > :startTime', { startTime }) // Preklapanje - kraj > pocetak nove
      .getCount();

    if (userOverlapping > 0) {
      throw new ConflictException(
        'You already have a booking during this time',
      );
    }

    // ---------------------------------------------------------------
    // SACUVAJ REZERVACIJU U BAZI
    // ---------------------------------------------------------------

    /**
     * bookingsRepository.create() - Kreira novi Booking objekat u memoriji (NE CUVA u bazi).
     * bookingsRepository.save() - Cuva objekat u bazi i vraca sacuvani entitet sa generisanim ID-om.
     * Razdvajamo ova dva koraka jer create() omogucava TypeORM-u da primeni
     * podrazumevane vrednosti (npr. status: 'active') pre cuvanja.
     */
    const booking = this.bookingsRepository.create({
      userId,
      roomId,
      date,
      startTime,
      endTime,
    });

    const saved = await this.bookingsRepository.save(booking);

    // ---------------------------------------------------------------
    // SLANJE DOGADJAJA PREKO RABBITMQ-a
    // ---------------------------------------------------------------

    /**
     * Emitujemo 'booking_created' dogadjaj (event) na RabbitMQ red (queue).
     * Notification-service slusa ovaj red i kada primi dogadjaj, salje
     * obavestenje korisniku (npr. email potvrdu o rezervaciji).
     *
     * emit() je "fire-and-forget" - ne cekamo odgovor od notification-service-a.
     * Ovo je primer ASINHRONE komunikacije izmedju mikroservisa.
     * Cak i ako notification-service ne radi, rezervacija ce biti sacuvana -
     * poruka ce cekati u RabbitMQ redu dok notification-service ne postane dostupan.
     */
    this.notificationsClient.emit('booking_created', {
      bookingId: saved.id,
      userId,
      roomId,
      date,
      startTime,
      endTime,
    });

    return saved;
  }

  /**
   * ===================================================================
   * FIND BY USER - Preuzimanje svih rezervacija jednog korisnika
   * ===================================================================
   *
   * Vraca sve rezervacije (i aktivne i otkazane) za datog korisnika,
   * sortirane po datumu i vremenu pocetka (rastuce).
   * Ovo se koristi za prikaz "Moje rezervacije" na frontendu.
   *
   * @param userId - ID korisnika cije rezervacije trazimo
   * @returns Niz rezervacija sortiranih po datumu i vremenu
   */
  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { userId },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * ===================================================================
   * FIND BY ID - Preuzimanje jedne rezervacije po ID-u
   * ===================================================================
   *
   * Trazi rezervaciju po njenom UUID-u. Ako ne postoji, baca NotFoundException (HTTP 404).
   * Ova metoda se koristi interno (npr. u cancel metodi) i takodje kao
   * samostalni endpoint za pregled detalja jedne rezervacije.
   *
   * @param id - UUID rezervacije
   * @returns Pronadjena rezervacija
   * @throws NotFoundException ako rezervacija ne postoji
   */
  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /**
   * ===================================================================
   * FIND BY ROOM - Preuzimanje svih aktivnih rezervacija za sobu na datum
   * ===================================================================
   *
   * Vraca sve aktivne rezervacije za odredjenu sobu na odredjeni datum.
   * Ovo se koristi za prikaz zauzetosti sobe na frontendu (kalendar/raspored).
   * Vraca samo aktivne rezervacije jer otkazane ne zauzimaju termin.
   *
   * @param roomId - ID sobe
   * @param date - Datum u formatu YYYY-MM-DD
   * @returns Niz aktivnih rezervacija sortiranih po vremenu pocetka
   */
  async findByRoom(roomId: string, date: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { roomId, date, status: 'active' },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * ===================================================================
   * CANCEL - Otkazivanje rezervacije
   * ===================================================================
   *
   * Otkazuje postojecu rezervaciju (menja status iz 'active' u 'cancelled').
   * Proverava da li korisnik koji pokusava da otkaze jeste vlasnik rezervacije.
   * Nakon otkazivanja, salje 'booking_cancelled' dogadjaj preko RabbitMQ-a.
   *
   * @param id - UUID rezervacije koja se otkazuje
   * @param userId - ID korisnika koji pokusava da otkaze (iz x-user-id header-a)
   * @returns Azurirana rezervacija sa statusom 'cancelled'
   * @throws BadRequestException ako korisnik nije vlasnik ili je vec otkazana
   */
  async cancel(id: string, userId: string): Promise<Booking> {
    // Prvo pronadjemo rezervaciju - ako ne postoji, findById ce baciti NotFoundException
    const booking = await this.findById(id);

    /**
     * Bezbednosna provera - korisnik moze da otkaze samo SVOJU rezervaciju.
     * Ovo je vazno jer ne zelimo da jedan korisnik moze da otkaze tudju rezervaciju.
     * userId dolazi iz x-user-id header-a koji postavlja API Gateway nakon autentifikacije.
     */
    if (booking.userId !== userId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    /**
     * Provera da li je rezervacija vec otkazana - ne mozemo dvaput otkazati istu rezervaciju.
     * Ovo je idempotentnost - ponovljeni zahtev nece imati drugaciji efekat.
     */
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Menjamo status na 'cancelled' i cuvamo u bazi (soft delete pristup)
    booking.status = 'cancelled';
    const saved = await this.bookingsRepository.save(booking);

    /**
     * Emitujemo 'booking_cancelled' dogadjaj na RabbitMQ.
     * Notification-service ce primiti ovaj dogadjaj i obavestiti korisnika
     * da je njegova rezervacija uspesno otkazana.
     *
     * Isto kao kod kreiranja, koristimo emit() (fire-and-forget) jer
     * ne zelimo da otkazivanje ne uspe samo zato sto notification-service nije dostupan.
     */
    this.notificationsClient.emit('booking_cancelled', {
      bookingId: saved.id,
      userId,
      roomId: booking.roomId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });

    return saved;
  }

  /**
   * ===================================================================
   * HELPER: timeToMinutes - Konvertuje vreme iz "HH:MM" u minute
   * ===================================================================
   *
   * Privatna helper metoda koja pretvara string vreme u broj minuta od ponoci.
   * Ovo je neophodno da bismo mogli matematicki da poredimo i racunamo
   * razliku izmedju dva vremena.
   *
   * Primeri:
   *   "00:00" => 0 * 60 + 0  = 0 minuta
   *   "01:00" => 1 * 60 + 0  = 60 minuta
   *   "09:00" => 9 * 60 + 0  = 540 minuta
   *   "09:30" => 9 * 60 + 30 = 570 minuta
   *   "14:45" => 14 * 60 + 45 = 885 minuta
   *   "23:59" => 23 * 60 + 59 = 1439 minuta
   *
   * Kako radi:
   * 1. time.split(':') - deli string po ':' => ["09", "30"]
   * 2. .map(Number) - konvertuje svaki element u broj => [9, 30]
   * 3. Destrukturiranje [hours, minutes] => hours=9, minutes=30
   * 4. hours * 60 + minutes => 9 * 60 + 30 = 570
   *
   * @param time - Vreme u formatu "HH:MM"
   * @returns Broj minuta od ponoci
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
