// ============================================================================
// APP MODULE - Glavni (root) modul API Gateway aplikacije
// ============================================================================
// Ovo je koreni modul koji povezuje sve delove API Gateway-a.
// API Gateway ne pristupa bazi podataka direktno - on samo:
//   1. Prima zahteve od klijenata
//   2. Verifikuje JWT tokene (autentifikacija)
//   3. Prosledjuje zahteve odgovarajucim mikroservisima
//
// Zato su importovani samo moduli za konfiguraciju, autentifikaciju i JWT.
// ============================================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    // ConfigModule.forRoot({ isGlobal: true }) - ucitava environment varijable
    // iz .env fajla i cini ih dostupnim u celoj aplikaciji.
    // isGlobal: true znaci da ne moramo ponovo importovati ConfigModule
    // u svakom modulu - dostupan je svuda automatski.
    ConfigModule.forRoot({ isGlobal: true }),

    // PassportModule - NestJS wrapper oko Passport.js biblioteke za autentifikaciju.
    // Passport podrzava razlicite strategije (JWT, OAuth, Local, itd.).
    // Ovde ga koristimo za JWT strategiju.
    PassportModule,

    // JwtModule.register() - registruje JWT modul sa tajnim kljucem.
    // Ovaj kljuc MORA biti isti kao u User servisu koji kreira tokene.
    // Ako se kljucevi ne poklapaju, token verifikacija nece uspeti
    // i korisnici nece moci da pristupe zasticenim rutama.
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'coworking-secret-key',
    }),
  ],
  // AppController - jedini kontroler u gateway-u, sadrzi sve proxy rute.
  controllers: [AppController, MetricsController],
  // JwtStrategy - provider koji definise kako se JWT token dekodira i validira.
  // Passport automatski koristi ovu strategiju kada se primeni JwtAuthGuard.
  providers: [JwtStrategy],
})
export class AppModule {}
