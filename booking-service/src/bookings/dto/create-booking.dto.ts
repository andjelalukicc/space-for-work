/**
 * ===================================================================
 * CREATE BOOKING DTO - Data Transfer Object za kreiranje rezervacije
 * ===================================================================
 *
 * DTO (Data Transfer Object) je objekat koji definise strukturu i pravila
 * validacije za podatke koji dolaze u HTTP zahtevu (request body).
 *
 * Kada korisnik salje POST zahtev za kreiranje rezervacije, telo zahteva
 * mora da sadrzi tacno ova 4 polja: roomId, date, startTime, endTime.
 *
 * NestJS ValidationPipe (u kontroleru) automatski proverava da li su
 * sva polja prisutna i da li su u ispravnom formatu, koristeci
 * dekoratore iz class-validator biblioteke.
 *
 * Ako bilo koja validacija ne prodje, NestJS automatski vraca HTTP 400
 * sa jasnom porukom greske - zahtev NIKADA ne stize do servisa.
 *
 * NAPOMENA: userId NIJE deo ovog DTO-a jer dolazi iz x-user-id header-a
 * (koji postavlja API Gateway), a ne iz tela zahteva.
 */

// Uvoz validacionih dekoratora iz class-validator biblioteke
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateBookingDto {
  /**
   * ID sobe koja se rezervise.
   *
   * @IsString() - Proverava da je vrednost tipa string.
   *   Ako korisnik posalje broj ili objekat, validacija nece proci.
   *
   * @IsNotEmpty() - Proverava da string nije prazan ("").
   *   Samo @IsString() bi propustio prazan string, pa nam treba i ova provera.
   *
   * Primer validnog: "550e8400-e29b-41d4-a716-446655440000"
   * Primer nevalidnog: "" ili 123 ili null
   */
  @IsString()
  @IsNotEmpty()
  roomId: string;

  /**
   * Datum rezervacije u formatu YYYY-MM-DD.
   *
   * @IsString() - Proverava da je vrednost tipa string.
   *
   * @Matches(/^\d{4}-\d{2}-\d{2}$/) - Proverava da string odgovara regularnom izrazu
   * (regex) za format datuma YYYY-MM-DD.
   *
   * Objasnjenje regex-a:
   *   ^        - Pocetak stringa
   *   \d{4}    - Tacno 4 cifre (godina, npr. 2026)
   *   -        - Crtica kao separator
   *   \d{2}    - Tacno 2 cifre (mesec, npr. 02)
   *   -        - Crtica kao separator
   *   \d{2}    - Tacno 2 cifre (dan, npr. 18)
   *   $        - Kraj stringa
   *
   * { message: '...' } - Prilagodjena poruka greske umesto podrazumevane.
   *
   * Primer validnog: "2026-02-18"
   * Primer nevalidnog: "18-02-2026" ili "2026/02/18" ili "2026-2-8"
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  /**
   * Vreme pocetka rezervacije u formatu HH:MM.
   *
   * @IsString() - Proverava da je string tip.
   *
   * @Matches(/^\d{2}:\d{2}$/) - Proverava format HH:MM pomocu regex-a.
   *
   * Objasnjenje regex-a:
   *   ^        - Pocetak stringa
   *   \d{2}    - Tacno 2 cifre (sat, npr. 09)
   *   :        - Dvotacka kao separator
   *   \d{2}    - Tacno 2 cifre (minut, npr. 30)
   *   $        - Kraj stringa
   *
   * NAPOMENA: Ovaj regex samo proverava FORMAT, ne i validnost vremena.
   * Npr. "99:99" bi prosao regex ali nije validno vreme.
   * Dodatna validacija (intervali od 30 min) se radi u BookingsService.
   *
   * Primer validnog: "09:00", "14:30", "23:00"
   * Primer nevalidnog: "9:00" ili "09:0" ili "09-00"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Start time must be in HH:MM format' })
  startTime: string;

  /**
   * Vreme zavrsetka rezervacije u formatu HH:MM.
   *
   * Ista validacija kao za startTime - proverava se samo format.
   * Logicka validacija (da li je endTime posle startTime, da li je razlika
   * najmanje 30 min, itd.) se obavlja u BookingsService.create() metodi.
   *
   * Primer validnog: "10:00", "15:30"
   * Primer nevalidnog: "10" ili "10:0" ili "ten:thirty"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'End time must be in HH:MM format' })
  endTime: string;
}
