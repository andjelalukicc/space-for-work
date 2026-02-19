// ============================================================================
// JWT STRATEGY - Strategija za dekodiranje i validaciju JWT tokena
// ============================================================================
// Ovaj fajl definise KAKO se JWT token dekodira i validira.
//
// KAKO RADI JWT AUTENTIFIKACIJA?
// 1. Korisnik se loguje na User servis i dobija JWT token
// 2. Klijent salje taj token u svakom zahtevu kao "Authorization: Bearer <token>"
// 3. API Gateway prima zahtev i JwtStrategy:
//    a) IZVLACI token iz Authorization headera (Bearer token format)
//    b) DEKODIRA token koristeci tajni kljuc (secret key)
//    c) PROVERAVA da li token nije istekao (expiration)
//    d) POZIVA validate() metodu sa dekodiranim podacima (payload)
//    e) Ono sto validate() vrati se stavlja u req.user objekat
//
// JWT TOKEN PAYLOAD sadrzi:
//   - sub: ID korisnika (subject - standardno JWT polje)
//   - email: email adresa korisnika
//   - role: uloga korisnika (npr. 'user' ili 'admin')
//
// VAZNO: Tajni kljuc (secret) MORA biti isti kao u User servisu
// koji kreira tokene. Ako se razlikuju, dekodiranje ce propasti.
// ============================================================================

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

// @Injectable() - omogucava da NestJS DI sistem kreira i injektuje ovu klasu.
// PassportStrategy(Strategy) - nasledjujemo Passport JWT strategiju.
// NestJS automatski registruje ovu strategiju pod imenom 'jwt' (podrazumevano ime).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    // super() poziva konstruktor Passport JWT strategije sa konfiguracijom:
    super({
      // jwtFromRequest - definise ODAKLE se izvlaci token iz HTTP zahteva.
      // fromAuthHeaderAsBearerToken() znaci da se token ocekuje u formatu:
      // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      // Passport automatski razdvaja "Bearer" od samog tokena.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // ignoreExpiration: false - NE ignorisi istek tokena.
      // Ako je token istekao, autentifikacija NECE uspeti i korisnik
      // dobija 401 Unauthorized gresku. Ovo je vazno za bezbednost.
      ignoreExpiration: false,

      // secretOrKey - tajni kljuc za verifikaciju potpisa tokena.
      // JWT token je potpisan ovim kljucem kada je kreiran u User servisu.
      // Ovde se koristi ISTI kljuc da se verifikuje da token nije falsifikovan.
      // Cita se iz JWT_SECRET env varijable ili koristi podrazumevanu vrednost.
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'coworking-secret-key',
      ),
    });
  }

  // validate() - poziva se NAKON sto Passport uspesno dekodira i verifikuje token.
  // Prima payload - dekodirani sadrzaj JWT tokena.
  //
  // Payload koji dolazi iz tokena:
  //   { sub: "user-uuid-123", email: "user@example.com", role: "user" }
  //
  // Ova metoda TRANSFORMISE payload u format koji ce biti dostupan u req.user:
  //   { id: "user-uuid-123", email: "user@example.com", role: "user" }
  //
  // Primetite da se "sub" (subject) mapira u "id" - ovo je zato sto je
  // "sub" standardno JWT ime za identifikator, ali u ostatku aplikacije
  // koristimo "id" jer je intuitivnije (req.user.id umesto req.user.sub).
  //
  // Ono sto ova metoda vrati se automatski stavlja u req.user objekat,
  // koji se zatim koristi u kontroleru (npr. req.user.id za x-user-id header).
  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
