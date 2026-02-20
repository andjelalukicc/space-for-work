import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
