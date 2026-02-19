/**
 * ===================================================================
 * BOOKINGS MODULE - Modul koji povezuje sve delove booking funkcionalnosti
 * ===================================================================
 *
 * U NestJS-u, modul je osnovna organizaciona jedinica aplikacije.
 * Ovaj modul "spaja" sve potrebne komponente za rad sa rezervacijama:
 * - Kontroler (BookingsController) - prima HTTP zahteve
 * - Servis (BookingsService) - sadrzi poslovnu logiku
 * - Entitet (Booking) - definise strukturu tabele u bazi
 * - RabbitMQ klijent - omogucava slanje poruka ka notification-service-u
 *
 * NestJS koristi @Module dekorator da zna koje klase pripadaju ovom modulu
 * i kako su medjusobno povezane. Ovo je deo modularnog dizajna NestJS-a.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // Za registraciju entiteta u bazi
import { ClientsModule, Transport } from '@nestjs/microservices'; // Za komunikaciju sa drugim mikroservisima
import { ConfigModule, ConfigService } from '@nestjs/config'; // Za citanje env varijabli (npr. RABBITMQ_URL)
import { Booking } from './booking.entity'; // Entitet rezervacije
import { BookingsService } from './bookings.service'; // Servis sa poslovnom logikom
import { BookingsController } from './bookings.controller'; // REST API kontroler

/**
 * @Module dekorator konfiguracije:
 *
 * - imports: Drugi moduli cije funkcionalnosti ovaj modul koristi
 * - controllers: Kontroleri koji pripadaju ovom modulu (primaju HTTP zahteve)
 * - providers: Servisi (provideri) koji pripadaju ovom modulu (poslovna logika)
 */
@Module({
  imports: [
    /**
     * TypeOrmModule.forFeature([Booking]) - Registruje Booking entitet za ovaj modul.
     * Ovo omogucava da BookingsService moze da koristi @InjectRepository(Booking)
     * za pristup TypeORM repozitorijumu (koji pruza metode za rad sa bazom).
     *
     * Bez ove linije, NestJS ne bi znao da treba da kreira repozitorijum
     * za Booking entitet i Dependency Injection bi pukao.
     */
    TypeOrmModule.forFeature([Booking]),

    /**
     * ClientsModule.registerAsync() - Registruje RabbitMQ klijent za slanje poruka
     * ka notification-service-u.
     *
     * Koristimo registerAsync (asinhronu registraciju) umesto register jer nam treba
     * pristup ConfigService-u da bismo procitali RABBITMQ_URL iz environment varijabli.
     * Sinhrona register() metoda ne bi mogla da pristupi ConfigService-u.
     *
     * Konfiguracija:
     * - name: 'NOTIFICATIONS_SERVICE' - Token za Dependency Injection. U servisu
     *   koristimo @Inject('NOTIFICATIONS_SERVICE') da pristupimo ovom klijentu.
     *
     * - transport: Transport.RMQ - Koristimo RabbitMQ kao transportni protokol
     *   za komunikaciju izmedju mikroservisa.
     *
     * - urls: URL do RabbitMQ servera. Cita se iz RABBITMQ_URL env varijable,
     *   a ako nije definisana, koristi se podrazumevana vrednost za lokalni razvoj.
     *
     * - queue: 'notifications_queue' - Naziv RabbitMQ reda (queue) na koji
     *   saljemo poruke. Notification-service slusa ovaj isti red.
     *
     * - queueOptions.durable: true - Red je "trajan" (durable), sto znaci da
     *   poruke u redu prezivljavaju restart RabbitMQ servera.
     *   Ovo je VAZNO jer garantuje da se poruke nece izgubiti ako RabbitMQ padne.
     */
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATIONS_SERVICE',
        imports: [ConfigModule], // Uvozimo ConfigModule da bi ConfigService bio dostupan u factory-ju
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://guest:guest@localhost:5672', // Podrazumevana vrednost za lokalni razvoj
              ),
            ],
            queue: 'notifications_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService], // Govori NestJS-u da ubaci ConfigService u useFactory funkciju
      },
    ]),
  ],
  controllers: [BookingsController], // Registracija kontrolera - NestJS ce automatski mapirati rute
  providers: [BookingsService], // Registracija servisa - NestJS ce ga ucitati za Dependency Injection
})
export class BookingsModule {}
