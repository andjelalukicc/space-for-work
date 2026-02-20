/**
 * USERS MODULE - Povezuje sve delove User servisa
 *
 * Modul u NestJS-u je kao "kutija" koja grupise povezane delove:
 * - imports: sta ovaj modul KORISTI (baza, JWT, Passport)
 * - controllers: koje HTTP rute su dostupne
 * - providers: koji servisi postoje (biznis logika)
 * - exports: sta ovaj modul DELI sa drugim modulima
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtStrategy } from '../auth/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Registruje User entitet za rad sa bazom
    PassportModule, // Passport.js - biblioteka za autentifikaciju
    JwtModule.registerAsync({
      // Konfiguracija JWT modula
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'coworking-secret-key'), // Tajni kljuc za potpisivanje tokena
        signOptions: { expiresIn: '24h' }, // Token istice za 24 sata
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController], // HTTP rute
  providers: [UsersService, JwtStrategy], // Biznis logika + JWT strategija
  exports: [UsersService, JwtModule], // Deli sa drugim modulima ako zatreba
})
export class UsersModule {}
