/**
 * ===================================================================
 * BOOKINGS CONTROLLER - REST API kontroler za upravljanje rezervacijama
 * ===================================================================
 *
 * Ovaj kontroler definise HTTP endpoint-e (rute) za booking-service.
 * Koristi se kao ulazna tacka za sve HTTP zahteve vezane za rezervacije.
 *
 * VAZNO - x-user-id header:
 * U mikroservisnoj arhitekturi, korisnik se NIKADA ne obraca direktno ovom servisu.
 * Zahtev ide ovako: Korisnik -> API Gateway -> booking-service
 *
 * API Gateway:
 * 1. Prima zahtev od korisnika sa JWT tokenom u Authorization header-u
 * 2. Verifikuje JWT token pozivom ka auth-service-u
 * 3. Iz tokena izvlaci userId i postavlja ga u 'x-user-id' header
 * 4. Prosledjuje zahtev ka booking-service-u SA x-user-id header-om
 *
 * Zato ovaj kontroler cita userId iz header-a umesto iz tokena direktno -
 * autentifikacija je vec obavljena u API Gateway-u, a booking-service
 * samo treba da zna KO je korisnik.
 *
 * Dostupne rute:
 *   POST   /bookings           - Kreiranje nove rezervacije
 *   GET    /bookings           - Preuzimanje svih rezervacija korisnika
 *   GET    /bookings/room/:id  - Preuzimanje rezervacija za sobu
 *   GET    /bookings/:id       - Preuzimanje jedne rezervacije po ID-u
 *   DELETE /bookings/:id       - Otkazivanje rezervacije
 */

import {
  Controller, // Dekorator koji oznacava klasu kao kontroler
  Post, // Dekorator za POST HTTP metodu (kreiranje resursa)
  Get, // Dekorator za GET HTTP metodu (citanje resursa)
  Delete, // Dekorator za DELETE HTTP metodu (brisanje/otkazivanje resursa)
  Body, // Dekorator za citanje tela (body) HTTP zahteva
  Param, // Dekorator za citanje URL parametara (npr. :id)
  Query, // Dekorator za citanje query parametara (npr. ?date=2026-01-01)
  Headers, // Dekorator za citanje HTTP header-a (npr. x-user-id)
  ValidationPipe, // Pipe koji automatski validira ulazne podatke prema DTO pravilima
  UnauthorizedException, // HTTP 401 - koristi se kada korisnik nije autentifikovan
} from '@nestjs/common';
import { BookingsService } from './bookings.service'; // Servis sa poslovnom logikom
import { CreateBookingDto } from './dto/create-booking.dto'; // DTO za validaciju ulaznih podataka

/**
 * @Controller('bookings') - Definise prefiks rute za sve endpoint-e u ovom kontroleru.
 * Svi endpoint-i ce pocinjati sa /bookings (npr. POST /bookings, GET /bookings/:id).
 */
@Controller('bookings')
export class BookingsController {
  /**
   * Dependency Injection - NestJS automatski ubacuje BookingsService instancu.
   * 'private readonly' znaci da je servis dostupan samo unutar ove klase
   * i ne moze se menjati nakon inicijalizacije.
   */
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /bookings - Kreiranje nove rezervacije
   *
   * @Body(ValidationPipe) - Automatski validira telo zahteva prema pravilima
   * definisanim u CreateBookingDto (provera formata datuma, vremena, itd.).
   * Ako validacija ne prodje, NestJS automatski vraca HTTP 400 sa greskom.
   *
   * @Headers('x-user-id') - Cita vrednost 'x-user-id' header-a iz HTTP zahteva.
   * Ovaj header postavlja API Gateway nakon uspesne autentifikacije korisnika.
   * Sadrzi UUID korisnika koji salje zahtev.
   */
  @Post()
  async create(
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    // Ako x-user-id header nije prisutan, zahtev nije prosao kroz API Gateway
    // ili korisnik nije autentifikovan - vracamo HTTP 401
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.create(userId, createBookingDto);
  }

  /**
   * GET /bookings - Preuzimanje svih rezervacija ulogovanog korisnika
   *
   * Korisnik ne moze da vidi tudje rezervacije - vraca samo njegove.
   * userId se automatski cita iz x-user-id header-a (postavljen od API Gateway-a).
   */
  @Get()
  async findByUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.findByUser(userId);
  }

  /**
   * GET /bookings/room/:roomId?date=YYYY-MM-DD - Preuzimanje rezervacija za sobu
   *
   * Ova ruta je javna (ne zahteva x-user-id) jer svi korisnici treba da vide
   * zauzetost sobe da bi znali kada je slobodna za rezervaciju.
   *
   * @Param('roomId') - Cita roomId iz URL putanje (npr. /bookings/room/abc-123)
   * @Query('date') - Cita datum iz query stringa (npr. ?date=2026-02-18)
   *
   * VAZNO: Ova ruta mora biti definisana PRE rute ':id' jer bi inace
   * NestJS protumacio 'room' kao vrednost :id parametra.
   */
  @Get('room/:roomId')
  async findByRoom(
    @Param('roomId') roomId: string,
    @Query('date') date: string,
  ) {
    return this.bookingsService.findByRoom(roomId, date);
  }

  /**
   * GET /bookings/:id - Preuzimanje jedne rezervacije po njenom ID-u
   *
   * @Param('id') - Cita UUID rezervacije iz URL putanje (npr. /bookings/550e8400-...)
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  /**
   * DELETE /bookings/:id - Otkazivanje rezervacije
   *
   * Korisnik moze da otkaze samo svoju rezervaciju (provera se vrsi u servisu).
   * Rezervacija se ne brise fizicki iz baze vec joj se status menja na 'cancelled'.
   *
   * @Param('id') - UUID rezervacije koja se otkazuje
   * @Headers('x-user-id') - ID korisnika koji pokusava da otkaze (iz API Gateway-a)
   */
  @Delete(':id')
  async cancel(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.cancel(id, userId);
  }
}
