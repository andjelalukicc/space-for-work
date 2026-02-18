// ============================================================================
// NOTIFICATIONS CONTROLLER - Kontroler za prijem HTTP zahteva i RabbitMQ dogadjaja
// ============================================================================
// Ovaj kontroler ima DVOSTRUKU ulogu:
//
// 1. RABBITMQ EVENT LISTENER (mikroservisna komunikacija):
//    - Osluskuje dogadjaje iz RabbitMQ reda pomocu @EventPattern dekoratora
//    - Kada Booking servis emituje event (npr. 'booking_created'),
//      RabbitMQ ga dostavlja u 'notifications_queue' red,
//      a NestJS automatski poziva odgovarajucu metodu u ovom kontroleru
//    - Ovo je ASINHRONA komunikacija - Booking servis ne ceka odgovor
//
// 2. HTTP REST ENDPOINT (za API Gateway):
//    - Pruza HTTP rute za dohvatanje notifikacija (/notifications)
//    - Pruza HTTP rutu za oznacavanje notifikacije kao procitane
//    - Ove rute poziva API Gateway kada korisnik zatrazi notifikacije
//
// @EventPattern vs @MessagePattern:
//    - @EventPattern = fire-and-forget (posalji i zaboravi), nema odgovora
//    - @MessagePattern = request-response, ocekuje se odgovor
//    Koristimo @EventPattern jer Booking servisu ne treba odgovor od notifikacija.
// ============================================================================

import {
  Controller,
  Get,
  Patch,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

// @Controller('notifications') - definise baznu putanju '/notifications'
// za sve HTTP rute u ovom kontroleru.
@Controller('notifications')
export class NotificationsController {
  // Dependency Injection - NestJS automatski ubacuje NotificationsService
  // instancu u kontroler kroz konstruktor.
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // @EventPattern('booking_created') - ovaj dekorator registruje metodu
  // kao LISTENER za RabbitMQ event sa pattern-om 'booking_created'.
  // Kada Booking servis posalje poruku sa ovim pattern-om u RabbitMQ,
  // NestJS ce automatski pozvati ovu metodu.
  // @Payload() izvlaci telo poruke (data) iz RabbitMQ eventa.
  // Ovo je kljucni deo event-driven arhitekture - servisi komuniciraju
  // asinhrono preko message brokera (RabbitMQ) umesto direktnih HTTP poziva.
  @EventPattern('booking_created')
  async handleBookingCreated(@Payload() data: any) {
    console.log('Received booking_created event:', data);
    return this.notificationsService.handleBookingCreated(data);
  }

  // @EventPattern('booking_cancelled') - osluskuje event otkazivanja rezervacije.
  // Radi na isti nacin kao handleBookingCreated, ali za otkazivanje.
  // Booking servis emituje ovaj event kada korisnik otkaze rezervaciju.
  @EventPattern('booking_cancelled')
  async handleBookingCancelled(@Payload() data: any) {
    console.log('Received booking_cancelled event:', data);
    return this.notificationsService.handleBookingCancelled(data);
  }

  // GET /notifications - dohvata sve notifikacije za ulogovanog korisnika.
  // @Headers('x-user-id') - izvlaci ID korisnika iz HTTP headera.
  // Ovaj header postavlja API Gateway nakon sto verifikuje JWT token.
  // Ako header ne postoji, baca UnauthorizedException (HTTP 401).
  @Get()
  async findByUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.notificationsService.findByUser(userId);
  }

  // PATCH /notifications/:id/read - oznacava notifikaciju kao procitanu.
  // @Param('id') izvlaci ID notifikacije iz URL putanje.
  // Npr. PATCH /notifications/abc-123/read => id = "abc-123"
  // Koristi PATCH umesto PUT jer menjamo samo jedno polje (isRead),
  // a ne ceo resurs. Ovo je u skladu sa REST konvencijama.
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
