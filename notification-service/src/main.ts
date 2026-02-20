// ============================================================================
// MAIN.TS - Ulazna tacka (entry point) Notification servisa
// ============================================================================
// Ovaj fajl pokrece Notification servis kao HIBRIDNU (HYBRID) aplikaciju.
//
// STA JE HYBRID APLIKACIJA?
// Hybrid aplikacija je NestJS aplikacija koja istovremeno radi kao:
//   1. HTTP SERVER (port 3004) - prima REST zahteve od API Gateway-a
//      Npr. GET /notifications (dohvati notifikacije korisnika)
//      Npr. PATCH /notifications/:id/read (oznaci kao procitano)
//
//   2. RABBITMQ CONSUMER (mikroservis) - osluskuje poruke iz RabbitMQ reda
//      Npr. event 'booking_created' - kada Booking servis kreira rezervaciju
//      Npr. event 'booking_cancelled' - kada Booking servis otkaze rezervaciju
//
// ZASTO HYBRID?
// Notification servis mora da:
//   - Prima HTTP zahteve (korisnik trazi svoje notifikacije)
//   - Prima asinhrone poruke iz RabbitMQ (novi booking je kreiran)
// Obicna NestJS app podrzava samo HTTP, obican mikroservis samo poruke.
// Hybrid kombinuje oba pristupa u jednoj aplikaciji.
//
// TOK PODATAKA:
//   Korisnik -> API Gateway -> HTTP -> Notification servis (GET notifikacije)
//   Booking servis -> RabbitMQ -> Notification servis (kreiranje notifikacije)
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Korak 1: Kreiramo standardnu HTTP aplikaciju pomocu NestFactory.create().
  // Ovo omogucava servisu da prima REST HTTP zahteve (GET, POST, PATCH, itd.).
  const app = await NestFactory.create(AppModule);

  // Korak 2: Povezujemo mikroservisni transport (RabbitMQ) na postojecu HTTP app.
  // connectMicroservice() dodaje RabbitMQ consumer funkcionalnost
  // BEZ zamene HTTP servera. Ovo je kljuc HYBRID pristupa.
  app.connectMicroservice<MicroserviceOptions>({
    // Transport.RMQ - koristimo RabbitMQ kao message broker (posrednik poruka).
    // RabbitMQ je sistem za razmenu poruka izmedju servisa (message queue).
    transport: Transport.RMQ,
    options: {
      // URL za konekciju na RabbitMQ server.
      // Koristi environment varijablu ili podrazumevanu lokalnu adresu.
      // Format: amqp://korisnik:lozinka@host:port
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
      // Ime reda (queue) iz koga ovaj servis cita poruke.
      // Booking servis salje poruke u ovaj isti red.
      queue: 'notifications_queue',
      // durable: true - red prezivljava restart RabbitMQ servera.
      // Poruke se cuvaju na disku, pa se ne gube ako RabbitMQ padne.
      queueOptions: { durable: true },
    },
  });

  // Korak 3: Pokrecemo sve registrovane mikroservise (RabbitMQ consumer).
  // Ovo pocinje osluskivanje poruka iz 'notifications_queue' reda.
  await app.startAllMicroservices();

  // Korak 4: Pokrecemo HTTP server na portu 3004 (ili iz env varijable).
  // Sada aplikacija ISTOVREMENO slusa i HTTP zahteve i RabbitMQ poruke.
  await app.listen(process.env.PORT ?? 3004);
  console.log('Notification Service running on port 3004 (HTTP + RabbitMQ)');
}
bootstrap();
