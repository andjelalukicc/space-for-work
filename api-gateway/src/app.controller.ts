// ============================================================================
// API GATEWAY CONTROLLER - Centralna tacka za sve klijentske zahteve
// ============================================================================
// Ovaj kontroler implementira PROXY PATTERN (obrazac posrednika).
//
// STA JE PROXY PATTERN U API GATEWAY-U?
// API Gateway je jedina ulazna tacka za klijente (frontend aplikaciju).
// Umesto da klijent direktno komunicira sa svakim mikroservisom,
// svi zahtevi idu kroz API Gateway koji:
//   1. PRIMA zahtev od klijenta (npr. GET /api/bookings)
//   2. PROVERAVA JWT token (da li je korisnik ulogovan i ko je)
//   3. PROSLEDJUJE zahtev odgovarajucem mikroservisu (npr. Booking servis)
//   4. DODAJE x-user-id header sa ID-jem korisnika iz JWT tokena
//   5. VRACA odgovor mikroservisa nazad klijentu
//
// ZASTO KORISTIMO API GATEWAY?
// - Klijent poznaje samo jednu adresu (gateway), ne mora da zna za sve servise
// - Centralizovana autentifikacija - JWT se proverava na jednom mestu
// - Lakse dodavanje novih servisa bez promene na klijentu
// - Moze se dodati rate limiting, logging, CORS na jednom mestu
//
// TOK ZAHTEVA:
//   Klijent -> API Gateway (:3000) -> proverava JWT -> dodaje x-user-id
//     -> prosledjuje ka User servisu (:3001) / Room servisu (:3002)
//        / Booking servisu (:3003) / Notification servisu (:3004)
// ============================================================================

import {
  Controller,
  All,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import axios from 'axios';

// @Controller() bez parametra - rute pocinju od korena (/).
@Controller()
export class AppController {
  // Mapa koja cuva URL adrese svih mikroservisa.
  // Kljuc je ime servisa, a vrednost je njegova bazna URL adresa.
  private serviceUrls: Record<string, string>;

  constructor(private configService: ConfigService) {
    // Inicijalizacija URL adresa svih mikroservisa.
    // ConfigService cita vrednosti iz environment varijabli (.env fajla).
    // Ako env varijabla ne postoji, koristi se podrazumevana localhost adresa.
    // U produkciji, ove adrese bi bile Docker kontejner imena ili Kubernetes servisi.
    this.serviceUrls = {
      users: configService.get('USER_SERVICE_URL', 'http://localhost:3001'),
      rooms: configService.get('ROOM_SERVICE_URL', 'http://localhost:3002'),
      bookings: configService.get('BOOKING_SERVICE_URL', 'http://localhost:3003'),
      notifications: configService.get('NOTIFICATION_SERVICE_URL', 'http://localhost:3004'),
    };
  }

  // GET /health - health check endpoint za proveru da li je gateway aktivan.
  // Vraca status i listu servisa. Koristi se za monitoring i load balancere.
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: Object.keys(this.serviceUrls),
    };
  }

  // ==================== JAVNE RUTE (bez autentifikacije) ====================
  // Ove rute NE koriste @UseGuards(JwtAuthGuard), sto znaci da su dostupne
  // svim korisnicima bez JWT tokena. Registracija i login moraju biti javni
  // jer korisnik jos nema token pre nego sto se uloguje.

  // @All('api/users/register') - hvata SVE HTTP metode (GET, POST, PUT, itd.)
  // na putanji /api/users/register i prosledjuje ih User servisu.
  @All('api/users/register')
  async proxyRegister(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/register');
  }

  // Prosledjuje login zahteve ka User servisu.
  @All('api/users/login')
  async proxyLogin(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/login');
  }

  // Prosledjuje zahteve za listu soba ka Room servisu.
  // Javna ruta - gosti mogu da pregledaju dostupne sobe bez logovanja.
  @All('api/rooms')
  async proxyRooms(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'rooms', '/rooms');
  }

  // Prosledjuje zahteve za pojedinacnu sobu ka Room servisu.
  // Wildcard *path hvata sve sto dolazi posle /api/rooms/ (npr. /api/rooms/123).
  // Zatim se /api/rooms zamenjuje sa /rooms da odgovara ruti Room servisa.
  @All('api/rooms/*path')
  async proxyRoomsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/rooms', '/rooms');
    return this.proxyRequest(req, res, 'rooms', path);
  }

  // ==================== ZASTICENE RUTE (potrebna autentifikacija) ====================
  // Ove rute koriste @UseGuards(JwtAuthGuard) - guard proverava JWT token
  // pre nego sto dozvoli pristup. Ako token nije validan, vraca 401 Unauthorized.
  // Nakon uspesne verifikacije, req.user sadrzi dekodirane podatke iz tokena.

  // Prosledjuje zahteve za korisnikov profil ka User servisu.
  // Zahteva JWT token jer samo ulogovani korisnik moze da vidi svoj profil.
  @UseGuards(JwtAuthGuard)
  @All('api/users/profile')
  async proxyProfile(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/profile');
  }

  // Prosledjuje zahteve za rezervacije ka Booking servisu.
  // req.user?.id - ID korisnika izvucen iz JWT tokena,
  // prosledjuje se kao x-user-id header da Booking servis zna ko pravi zahtev.
  @UseGuards(JwtAuthGuard)
  @All('api/bookings')
  async proxyBookings(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'bookings', '/bookings', req.user?.id);
  }

  // Prosledjuje zahteve za pojedinacnu rezervaciju (npr. /api/bookings/123/cancel).
  @UseGuards(JwtAuthGuard)
  @All('api/bookings/*path')
  async proxyBookingsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/bookings', '/bookings');
    return this.proxyRequest(req, res, 'bookings', path, req.user?.id);
  }

  // Prosledjuje zahteve za notifikacije ka Notification servisu.
  @UseGuards(JwtAuthGuard)
  @All('api/notifications')
  async proxyNotifications(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'notifications', '/notifications', req.user?.id);
  }

  // Prosledjuje zahteve za pojedinacnu notifikaciju (npr. /api/notifications/123/read).
  @UseGuards(JwtAuthGuard)
  @All('api/notifications/*path')
  async proxyNotificationsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/notifications', '/notifications');
    return this.proxyRequest(req, res, 'notifications', path, req.user?.id);
  }

  // ==================== PRIVATNA PROXY METODA ====================
  // Ovo je SRCE API Gateway-a - metoda koja zapravo prosledjuje zahteve.
  //
  // Parametri:
  //   req - originalni HTTP zahtev od klijenta
  //   res - HTTP response objekat za slanje odgovora nazad klijentu
  //   service - ime servisa kome se prosledjuje (npr. 'bookings')
  //   path - putanja na ciljnom servisu (npr. '/bookings/123')
  //   userId - (opciono) ID korisnika iz JWT tokena, dodaje se kao x-user-id header
  //
  // Koristi axios biblioteku za HTTP pozive ka mikroservisima.
  private async proxyRequest(
    req: any,
    res: any,
    service: string,
    path: string,
    userId?: string,
  ) {
    // Konstruisemo pun URL ciljnog servisa (npr. "http://localhost:3003/bookings")
    const url = `${this.serviceUrls[service]}${path}`;

    // Pripremamo headere koji ce se proslediti mikroservisu.
    const headers: Record<string, string> = {
      'content-type': req.headers['content-type'] || 'application/json',
    };

    // AKO postoji userId (iz JWT tokena), dodajemo ga kao x-user-id header.
    // Ovo je nacin na koji API Gateway PROSLEDJUJE identitet korisnika
    // mikroservisima. Mikroservisi ne dekodiraju JWT sami - veruju
    // API Gateway-u i citaju x-user-id header.
    if (userId) {
      headers['x-user-id'] = userId;
    }

    // Prosledjujemo i Authorization header (JWT token) ako postoji.
    // Neki servisi (npr. User servis za profil) mogu sami da verifikuju token.
    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization;
    }

    try {
      // Saljemo HTTP zahtev ka mikroservisu koristeci axios.
      // Prosledjujemo istu HTTP metodu, telo, headere i query parametre.
      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        headers,
        params: req.query,
      });
      // Vracamo klijentu isti status kod i podatke koje je mikroservis vratio.
      res.status(response.status).json(response.data);
    } catch (error) {
      // Ako mikroservis vrati gresku (npr. 400, 404, 500),
      // prosledjujemo tu gresku nazad klijentu.
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        // Ako mikroservis uopste ne odgovara (pao je, nema mreze),
        // vracamo 503 Service Unavailable gresku.
        res.status(503).json({
          statusCode: 503,
          message: `Service ${service} is unavailable`,
        });
      }
    }
  }
}
