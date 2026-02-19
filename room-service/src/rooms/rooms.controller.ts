/**
 * Rooms Controller - Kontroler koji definise HTTP endpoint-e (API rute) za rad sa prostorijama.
 *
 * Kontroler je ulazna tacka za sve HTTP zahteve koji se odnose na prostorije.
 * On prima zahteve od klijenata, prosledjuje ih servisu na obradu, i vraca odgovor.
 *
 * Kontroler NE sadrzi poslovnu logiku - samo delegira pozive servisu.
 * Ovo je u skladu sa principom razdvajanja odgovornosti (Separation of Concerns).
 *
 * Definisani endpoint-i:
 * - GET /rooms              - Vraca sve aktivne prostorije
 * - GET /rooms/type/:type   - Vraca prostorije odredjenog tipa (meeting_room ili phone_booth)
 * - GET /rooms/availability/stream - SSE endpoint za reaktivno pracenje promena dostupnosti
 * - GET /rooms/:id          - Vraca jednu prostoriju po ID-u
 */

import { Controller, Get, Param, Sse } from '@nestjs/common';
import { RoomsService } from './rooms.service';
// Observable i map iz RxJS biblioteke - potrebni za implementaciju SSE (Server-Sent Events)
// Observable predstavlja tok podataka koji se emituje tokom vremena
// map operator transformise svaki emitovani podatak u zeljeni format
import { Observable, map } from 'rxjs';

// @Controller('rooms') - definise baznu putanju za sve rute u ovom kontroleru
// Svi endpoint-i ce imati prefiks /rooms (npr. /rooms, /rooms/:id, /rooms/type/:type)
@Controller('rooms')
export class RoomsController {
  // Dependency Injection - NestJS automatski injektuje instancu RoomsService
  // 'private readonly' znaci da je servis dostupan samo unutar ove klase i ne moze se menjati
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * GET /rooms - Endpoint za dobijanje svih aktivnih prostorija.
   *
   * Vraca listu svih prostorija koje su aktivne (isActive === true).
   * Klijent koristi ovaj endpoint da prikaze sve dostupne prostorije u coworking prostoru.
   * Odgovor je JSON niz Room objekata.
   */
  @Get()
  async findAll() {
    return this.roomsService.findAll();
  }

  /**
   * GET /rooms/type/:type - Endpoint za filtriranje prostorija po tipu.
   *
   * @Param('type') - izvlaci vrednost parametra iz URL putanje
   * Primer: GET /rooms/type/phone_booth vraca sve telefonske kabine
   * Primer: GET /rooms/type/meeting_room vraca sve sale za sastanke
   *
   * VAZNO: Ova ruta mora biti definisana PRE rute /rooms/:id jer bi NestJS
   * inace protumacio "type" kao ID prostorije i pokusao da nadje prostoriju sa tim ID-om.
   */
  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    return this.roomsService.findByType(type);
  }

  /**
   * GET /rooms/availability/stream - SSE (Server-Sent Events) endpoint za reaktivnu komunikaciju.
   *
   * @Sse dekorator je NestJS-ov nacin za implementaciju Server-Sent Events-a.
   * SSE je protokol koji omogucava serveru da salje podatke klijentu u realnom vremenu
   * kroz jednu otvorenu HTTP konekciju. Za razliku od obicnog REST poziva gde klijent
   * pita server za podatke (pull model), ovde server aktivno salje podatke kada se desi promena
   * (push model).
   *
   * Ovo je zahtev specifikacije projekta - reaktivna komunikacija izmedju servisa.
   *
   * Kako radi:
   * 1. Klijent otvara konekciju ka ovom endpoint-u (EventSource u browseru)
   * 2. Servis emituje dogadjaje kroz RxJS Subject kada se promeni dostupnost prostorije
   * 3. pipe(map(...)) transformise svaki dogadjaj u format koji SSE ocekuje (MessageEvent)
   * 4. JSON.stringify pretvara objekat u string jer SSE salje tekstualne podatke
   * 5. Klijent prima dogadjaje u realnom vremenu bez ponovnog slanja zahteva
   *
   * Vraca Observable<MessageEvent> - tok poruka koji se salje klijentu.
   */
  @Sse('availability/stream')
  availabilityStream(): Observable<MessageEvent> {
    return this.roomsService.getAvailabilityStream().pipe(
      // map operator transformise svaki emitovani podatak iz Subject-a
      // u MessageEvent format koji je kompatibilan sa SSE protokolom
      map(
        (data) =>
          ({
            data: JSON.stringify(data),
          }) as MessageEvent,
      ),
    );
  }

  /**
   * GET /rooms/:id - Endpoint za dobijanje jedne prostorije po njenom UUID identifikatoru.
   *
   * @Param('id') - izvlaci UUID iz URL putanje
   * Primer: GET /rooms/550e8400-e29b-41d4-a716-446655440000
   *
   * Ako prostorija sa datim ID-om ne postoji, servis baca NotFoundException
   * i NestJS automatski vraca HTTP 404 odgovor klijentu.
   *
   * VAZNO: Ova ruta je poslednja jer je :id "wildcard" parametar -
   * sve sto dodje posle /rooms/ bi se poklopilo sa ovom rutom.
   * Zato specificnije rute (kao /rooms/type/:type) moraju biti definisane iznad.
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }
}
