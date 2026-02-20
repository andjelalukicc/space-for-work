/**
 * LOGGING MIDDLEWARE - Logovanje svakog HTTP zahteva
 *
 * Middleware je funkcija koja se izvrsava IZMEDJU prijema zahteva i obrade u kontroleru.
 * Ovaj middleware loguje svaki zahtev koji prodje kroz API Gateway:
 * - HTTP metoda (GET, POST, DELETE...)
 * - URL putanja
 * - IP adresa klijenta
 * - Vreme obrade zahteva (u milisekundama)
 * - HTTP status kod odgovora
 *
 * Ovo je korisno za:
 * - Debugging (kada nesto ne radi, vidimo sta se desilo)
 * - Monitoring (koliko zahteva dolazi, koliko traju)
 * - Security (ko pristupa API-ju)
 */
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  // Logger sa prefiksom 'HTTP' - svaka poruka ce imati [HTTP] prefiks
  private logger = new Logger('HTTP');

  use(req: any, res: any, next: () => void) {
    // Belezimo vreme kada je zahtev primljen
    const startTime = Date.now();

    // Izvlacimo podatke iz zahteva
    const { method, originalUrl, ip } = req;

    // Kada se odgovor zavrsi, logujemo kompletan zahtev
    // 'finish' event se emituje kada se svi podaci posalju klijentu
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Format: [HTTP] GET /api/rooms 200 - 12ms - 192.168.1.1
      // Koristimo razlicite nivoe logovanja zavisno od status koda:
      // - 2xx (uspeh) -> log (normalan nivo)
      // - 4xx (greska klijenta) -> warn (upozorenje)
      // - 5xx (greska servera) -> error (greska)
      const message = `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip}`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    // Pozivamo next() da prosledimo zahtev dalje ka kontroleru
    next();
  }
}
