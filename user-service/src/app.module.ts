/**
 * APP MODULE - Glavni modul User Service-a
 *
 * Ovo je "root" modul koji se prvi ucitava kada se servis pokrene.
 * Ovde se konfigurise:
 * - ConfigModule: ucitavanje environment varijabli (.env fajl)
 * - TypeOrmModule: konekcija na PostgreSQL bazu podataka
 * - UsersModule: nas custom modul za korisnike
 *
 * synchronize: true znaci da TypeORM automatski kreira/menja tabele
 * u bazi na osnovu entiteta. Ovo se koristi samo u DEVELOPMENT-u!
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    // Ucitava .env fajl - isGlobal znaci da je dostupan svuda u aplikaciji
    ConfigModule.forRoot({ isGlobal: true }),

    // Konekcija na PostgreSQL bazu
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'), // Default: localhost
        port: configService.get<number>('DB_PORT', 5432), // Default PostgreSQL port
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'coworking'), // Ime baze
        entities: [User], // Koje tabele da kreira
        synchronize: true, // Auto-kreiranje tabela (samo za development!)
      }),
      inject: [ConfigService],
    }),

    UsersModule, // Nas modul za korisnike
  ],
})
export class AppModule {}
