import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception.filter';

async function bootstrap() {
  // Kreiramo aplikaciju sa ugradjenim NestJS logger-om.
  // Logger ispisuje poruke u konzolu sa vremenskim pecatom i nivoom (LOG, ERROR, WARN).
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('APIGateway');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // ============================================
  // CORS - Cross-Origin Resource Sharing
  // ============================================
  // CORS dozvoljava frontend aplikaciji sa drugog domena/porta da pristupa nasem API-ju.
  // Bez CORS-a, browser blokira zahteve sa http://localhost:4200 ka http://localhost:3000.
  // origin: true - dozvoljava zahteve sa bilo kog domena (za development).
  // credentials: true - dozvoljava slanje kolacica i Authorization header-a.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
  logger.log('CORS omogucen za sve domene');

  // ============================================
  // Globalni ValidationPipe
  // ============================================
  // ValidationPipe automatski validira SVE dolazece zahteve koristeci class-validator.
  // whitelist: true - uklanja polja koja nisu definisana u DTO (sprecava injection)
  // forbidNonWhitelisted: true - baca gresku ako zahtev sadrzi nepoznato polje
  // transform: true - automatski konvertuje tipove (string "3001" -> number 3001)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Globalni exception filter za konzistentan format gresaka
  app.useGlobalFilters(new HttpExceptionFilter());

  // Konfiguracija Swagger dokumentacije pomocu DocumentBuilder-a.
  // DocumentBuilder koristi builder obrazac za postepeno definisanje opcija.
  const config = new DocumentBuilder()
    .setTitle('Coworking Booking System API')
    .setDescription(
      'API dokumentacija za sistem rezervacije prostorija u coworking prostoru',
    )
    .setVersion('1.0')
    // Dodajemo Bearer autentifikaciju - Swagger UI ce prikazati dugme "Authorize"
    // gde korisnik moze da unese JWT token za testiranje zasticenih ruta.
    .addBearerAuth()
    .build();

  // Kreiranje Swagger dokumenta na osnovu aplikacije i konfiguracije.
  // SwaggerModule automatski skenira sve kontrolere i njihove dekoratore.
  const document = SwaggerModule.createDocument(app, config);

  // Postavljanje Swagger UI na putanju /api-docs.
  // Korisnik moze pristupiti dokumentaciji na http://localhost:3000/api-docs
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`API Gateway pokrenut na portu ${port}`);
  logger.log(`Swagger UI dostupan na http://localhost:${port}/api-docs`);
}
bootstrap();
