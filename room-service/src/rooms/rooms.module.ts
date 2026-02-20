/**
 * Rooms Module - Modul koji objedinjuje sve komponente vezane za prostorije.
 *
 * U NestJS-u, modul je osnovni gradivni blok aplikacije. Svaki modul enkapsulira
 * skup povezanih komponenti (kontrolere, servise, entitete) u jednu celinu.
 * Ovo je u skladu sa principom modularnosti - svaki modul je zaduzen za jednu funkcionalnost.
 *
 * @Module dekorator prima objekat sa sledecim poljima:
 * - imports: Drugi moduli cije komponente ovaj modul koristi
 * - controllers: Kontroleri koji pripadaju ovom modulu (obradjuju HTTP zahteve)
 * - providers: Servisi (provideri) koji sadrze poslovnu logiku
 * - exports: Komponente koje ovaj modul deli sa drugim modulima koji ga uvoze
 *
 * Ovaj modul se uvozi u glavni AppModule aplikacije i tako postaje deo sistema.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './room.entity';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';

@Module({
  // TypeOrmModule.forFeature([Room]) - registruje Room entitet u okviru ovog modula
  // Ovo omogucava koriscenje @InjectRepository(Room) u servisima ovog modula
  // forFeature se koristi u feature modulima, dok se forRoot koristi u root modulu za konfiguraciju baze
  imports: [TypeOrmModule.forFeature([Room])],

  // Kontroleri koji obradjuju dolazece HTTP zahteve i vracaju odgovore klijentima
  controllers: [RoomsController],

  // Providers (servisi) koji sadrze poslovnu logiku - NestJS ih automatski instancira
  // i injektuje gde su potrebni putem Dependency Injection mehanizma
  providers: [RoomsService],

  // Exports - izvozimo RoomsService kako bi ga drugi moduli mogli koristiti
  // Na primer, booking modul moze da koristi RoomsService da proveri da li prostorija postoji
  // ili da emituje dogadjaje o promeni dostupnosti putem emitAvailabilityChange() metode
  exports: [RoomsService],
})
export class RoomsModule {}
