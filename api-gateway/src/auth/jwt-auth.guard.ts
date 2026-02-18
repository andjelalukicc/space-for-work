// ============================================================================
// JWT AUTH GUARD - Cuvar (guard) koji blokira neautorizovane zahteve
// ============================================================================
// Ovaj fajl definise GUARD - mehanizam u NestJS-u koji odlucuje
// da li ce zahtev biti DOZVOLJEN ili ODBIJEN pre nego sto stigne do kontrolera.
//
// KAKO RADI GUARD?
// Guard se izvrsava PRE kontrolera u NestJS request lifecycle-u:
//   Zahtev -> Guard -> (ako prodje) -> Kontroler -> Odgovor
//                   -> (ako ne prodje) -> 401 Unauthorized
//
// STA RADI OVAJ KONKRETNI GUARD?
// JwtAuthGuard nasledjuje AuthGuard('jwt') iz @nestjs/passport paketa.
// Parametar 'jwt' se odnosi na ime strategije - automatski poziva
// JwtStrategy koju smo definisali u jwt.strategy.ts.
//
// Kada se @UseGuards(JwtAuthGuard) primeni na rutu, desava se sledece:
//   1. Guard presrece dolazeci HTTP zahtev
//   2. Poziva JwtStrategy koja izvlaci JWT token iz Authorization headera
//   3. JwtStrategy verifikuje potpis tokena i proverava da li je istekao
//   4. Ako je token validan, poziva se validate() metoda iz JwtStrategy
//   5. Rezultat validate() se stavlja u req.user
//   6. Guard DOZVOLJAVA pristup kontroleru
//
//   Ako token ne postoji, nije validan, ili je istekao:
//   - Guard BLOKIRA zahtev
//   - Vraca HTTP 401 Unauthorized gresku
//   - Zahtev NIKADA ne stize do kontrolera
//
// GUDE SE KORISTI?
// U app.controller.ts se primenjuje na zasticene rute sa @UseGuards(JwtAuthGuard):
//   @UseGuards(JwtAuthGuard)
//   @All('api/bookings')
//   async proxyBookings(...) { ... }
//
// Javne rute (login, register, pregled soba) NE koriste ovaj guard.
// ============================================================================

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// @Injectable() - oznacava klasu kao NestJS provider.
// AuthGuard('jwt') - nasledjujemo gotov guard iz Passport biblioteke
// koji automatski koristi JWT strategiju registrovanu pod imenom 'jwt'.
// Klasa je prazna jer sva logika vec postoji u AuthGuard - mi je samo
// imenujemo (JwtAuthGuard) da bismo je lakse koristili u dekoratorima.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
