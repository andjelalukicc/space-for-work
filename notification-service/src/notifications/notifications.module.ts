// ============================================================================
// NOTIFICATIONS MODULE - NestJS modul koji grupishe sve delove notifikacija
// ============================================================================
// NestJS koristi modularnu arhitekturu - svaka funkcionalnost se organizuje
// u module. Modul objedinjuje kontrolere, servise i druge provajdere
// koji zajedno cine jednu celinu (feature).
//
// Ovaj modul registruje:
// - TypeORM repozitorijum za Notification entitet (pristup bazi)
// - NotificationsController (HTTP rute + RabbitMQ event listeneri)
// - NotificationsService (poslovna logika)
//
// Modul se zatim importuje u glavni AppModule aplikacije.
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

// @Module() dekorator definise NestJS modul sa sledecim svojstvima:
@Module({
  imports: [
    // TypeOrmModule.forFeature([Notification]) - registruje Notification
    // entitet za ovaj modul. Ovo omogucava koriscenje @InjectRepository(Notification)
    // u servisu za pristup bazi podataka.
    // forFeature() se koristi u feature modulima (za specificne entitete),
    // dok se forRoot() koristi u glavnom modulu (za konfiguraciju konekcije).
    TypeOrmModule.forFeature([Notification]),
  ],
  // controllers - lista kontrolera koji pripadaju ovom modulu.
  // NestJS ce automatski registrovati sve rute iz ovih kontrolera.
  controllers: [NotificationsController],
  // providers - lista servisa i drugih provajdera dostupnih u ovom modulu.
  // NestJS DI sistem ce ih automatski instancirati i injektovati gde je potrebno.
  providers: [NotificationsService],
})
export class NotificationsModule {}
