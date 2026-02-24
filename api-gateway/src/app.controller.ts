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

import { Controller, All, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
// Swagger dekoratori za automatsko generisanje API dokumentacije.
// @ApiTags - grupisanje endpointa po kategorijama u Swagger UI-ju.
// @ApiOperation - opis sta odredjena ruta radi.
// @ApiResponse - opis mogucih HTTP odgovora (status kodova).
// @ApiBearerAuth - oznacava da ruta zahteva JWT Bearer token.
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
      bookings: configService.get(
        'BOOKING_SERVICE_URL',
        'http://localhost:3003',
      ),
      notifications: configService.get(
        'NOTIFICATION_SERVICE_URL',
        'http://localhost:3004',
      ),
    };
  }

  // GET /health - health check endpoint za proveru da li je gateway aktivan.
  // Vraca status i listu servisa. Koristi se za monitoring i load balancere.
  // @ApiTags grupisanje - ovaj endpoint pripada kategoriji 'Health' u dokumentaciji.
  @ApiTags('Health')
  // @ApiOperation opisuje namenu endpointa u Swagger UI-ju.
  @ApiOperation({ summary: 'Provera zdravlja API Gateway-a' })
  // @ApiResponse definise moguce odgovore sa status kodom i opisom.
  @ApiResponse({ status: 200, description: 'Gateway je aktivan i zdrav' })
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
  // @ApiTags('Users') - grupisanje u kategoriju 'Users' u Swagger dokumentaciji.
  @ApiTags('Users')
  @ApiOperation({ summary: 'Registracija novog korisnika' })
  @ApiResponse({ status: 201, description: 'Korisnik uspesno registrovan' })
  @ApiResponse({ status: 400, description: 'Nevalidni podaci za registraciju' })
  @All('api/users/register')
  async proxyRegister(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/register');
  }

  // Prosledjuje login zahteve ka User servisu.
  @ApiTags('Users')
  @ApiOperation({ summary: 'Prijava korisnika (login)' })
  @ApiResponse({ status: 200, description: 'Uspesna prijava, vraca JWT token' })
  @ApiResponse({
    status: 401,
    description: 'Neispravni kredencijali (email ili lozinka)',
  })
  @All('api/users/login')
  async proxyLogin(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/login');
  }

  // Prosledjuje zahteve za listu soba ka Room servisu.
  // Javna ruta - gosti mogu da pregledaju dostupne sobe bez logovanja.
  @ApiTags('Rooms')
  @ApiOperation({ summary: 'Pregled svih dostupnih soba' })
  @ApiResponse({ status: 200, description: 'Lista soba uspesno vracena' })
  @All('api/rooms')
  async proxyRooms(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'rooms', '/rooms');
  }

  // Prosledjuje zahteve za pojedinacnu sobu ka Room servisu.
  // Wildcard *path hvata sve sto dolazi posle /api/rooms/ (npr. /api/rooms/123).
  // Zatim se /api/rooms zamenjuje sa /rooms da odgovara ruti Room servisa.
  @ApiTags('Rooms')
  @ApiOperation({ summary: 'Operacije nad pojedinacnom sobom (po ID-ju)' })
  @ApiResponse({ status: 200, description: 'Podaci o sobi uspesno vraceni' })
  @ApiResponse({
    status: 404,
    description: 'Soba sa datim ID-jem nije pronadjena',
  })
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
  // @ApiBearerAuth() oznacava da je JWT Bearer token potreban za ovu rutu.
  @ApiTags('Users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pregled profila ulogovanog korisnika' })
  @ApiResponse({ status: 200, description: 'Podaci o profilu uspesno vraceni' })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovan pristup - neispravan ili nedostajuci token',
  })
  @UseGuards(JwtAuthGuard)
  @All('api/users/profile')
  async proxyProfile(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'users', '/users/profile');
  }

  // Prosledjuje zahteve za rezervacije ka Booking servisu.
  // req.user?.id - ID korisnika izvucen iz JWT tokena,
  // prosledjuje se kao x-user-id header da Booking servis zna ko pravi zahtev.
  @ApiTags('Bookings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kreiranje ili pregled rezervacija' })
  @ApiResponse({
    status: 200,
    description: 'Lista rezervacija uspesno vracena',
  })
  @ApiResponse({ status: 201, description: 'Rezervacija uspesno kreirana' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  @UseGuards(JwtAuthGuard)
  @All('api/bookings')
  async proxyBookings(@Req() req, @Res() res) {
    return this.proxyRequest(req, res, 'bookings', '/bookings', req.user?.id);
  }

  // Prosledjuje zahteve za pojedinacnu rezervaciju (npr. /api/bookings/123/cancel).
  @ApiTags('Bookings')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Operacije nad pojedinacnom rezervacijom (pregled, otkazivanje)',
  })
  @ApiResponse({
    status: 200,
    description: 'Operacija nad rezervacijom uspesno izvrsena',
  })
  @ApiResponse({ status: 404, description: 'Rezervacija nije pronadjena' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  @UseGuards(JwtAuthGuard)
  @All('api/bookings/*path')
  async proxyBookingsById(@Req() req, @Res() res) {
    const path = req.url.replace('/api/bookings', '/bookings');
    return this.proxyRequest(req, res, 'bookings', path, req.user?.id);
  }

  // Prosledjuje zahteve za notifikacije ka Notification servisu.
  @ApiTags('Notifications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pregled notifikacija korisnika' })
  @ApiResponse({
    status: 200,
    description: 'Lista notifikacija uspesno vracena',
  })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  @UseGuards(JwtAuthGuard)
  @All('api/notifications')
  async proxyNotifications(@Req() req, @Res() res) {
    return this.proxyRequest(
      req,
      res,
      'notifications',
      '/notifications',
      req.user?.id,
    );
  }

  // GET /api/notifications/stream - SSE proxy.
  // Mora biti ISPRED wildcard rute da bi imao prioritet.
  // Koristi Node.js http modul umesto axios jer SSE je streaming (ne buffer).
  @ApiTags('Notifications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'SSE stream notifikacija u realnom vremenu' })
  @ApiResponse({ status: 200, description: 'text/event-stream' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  @UseGuards(JwtAuthGuard)
  @Get('api/notifications/stream')
  sseStream(@Req() req, @Res() res) {
    const userId = req.user?.id;
    const notifUrl = this.serviceUrls['notifications'];
    const parsed = new URL(`${notifUrl}/notifications/stream`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: Number(parsed.port) || 80,
      path: parsed.pathname,
      method: 'GET',
      headers: { 'x-user-id': userId, Accept: 'text/event-stream' },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => res.end());
    req.on('close', () => proxyReq.destroy());
    proxyReq.end();
  }

  // Prosledjuje zahteve za pojedinacnu notifikaciju (npr. /api/notifications/123/read).
  @ApiTags('Notifications')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Operacije nad pojedinacnom notifikacijom (oznacavanje kao procitano)',
  })
  @ApiResponse({
    status: 200,
    description: 'Operacija nad notifikacijom uspesno izvrsena',
  })
  @ApiResponse({ status: 404, description: 'Notifikacija nije pronadjena' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
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
