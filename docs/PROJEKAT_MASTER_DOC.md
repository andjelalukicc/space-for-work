# COWORKING BOOKING SYSTEM - Master Dokumentacija

## Pregled projekta
**Naziv:** Coworking Space Booking System
**Predmet:** Integracije (IROIT) - DevOps projekat
**Student:** Andjela Lukic
**GitHub repo:** https://github.com/IROIT-2025/iroit-grupa-3-4-andjelalukicc
**Tech stack:** Node.js (NestJS) + Docker + lokalni deploy
**Bodovi:** 30

---

## Opis aplikacije
Sistem za rezervaciju meeting room-ova i phone booth-ova u coworking prostoru.

### Prostorije:
- **Meeting Room 1 "Small"** - kapacitet 6-8 osoba, oprema: Smart TV, bela tabla
- **Meeting Room 2 "Large"** - kapacitet do 20 osoba, oprema: Smart TV, bela tabla
- **6 Phone Booth-ova** - kapacitet 1 osoba, za pozive/fokus rad

### Pravila rezervacije:
- Svi clanovi coworking-a mogu da pristupe i bukiraju
- **Radno vreme: 24h (non-stop)**
- **Minimalna rezervacija: 30 minuta**
- **Korisnik bira trajanje** - moze 30min, 1h, 2h, ili koliko zeli
- Meeting room-ovi se mogu koristiti i za individualne pozive
- Rezervacija se pravi po slotovima od 30min (npr. 14:00-16:00 = 4 slota)
- Jedan korisnik ne moze imati preklapajuce rezervacije
- Max 3 aktivne rezervacije po korisniku dnevno

### Postojece stanje u GitHub repo-u:
- Repo vec sadrzi starter Spring Boot (Java) Bookstore app sa vezbi
- Taj kod ce biti zamenjen nasim Node.js projektom na novom feature branch-u

---

## Arhitektura - Mikroservisi

```
                    ┌─────────────────┐
                    │   API Gateway   │ (port 3000)
                    │    (NestJS)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
   ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
   │  User Service │ │ Room Service │ │Booking Service│
   │   (NestJS)    │ │   (NestJS)   │ │   (NestJS)    │
   │   port 3001   │ │  port 3002   │ │  port 3003    │
   └───────────────┘ └──────────────┘ └───────┬───────┘
                                              │
                                        [RabbitMQ]
                                              │
                                    ┌─────────▼────────┐
                                    │Notification Svc  │
                                    │    (NestJS)      │
                                    │   port 3004      │
                                    └──────────────────┘

   Baza podataka: PostgreSQL (jedna instanca, odvojene scheme po servisu)
   Message Broker: RabbitMQ
   Monitoring: Prometheus + Grafana
```

### Mikroservis 1: User Service (port 3001)
- **Odgovornost:** Registracija, login, upravljanje clanovima
- **Endpointi:**
  - POST /users/register - registracija novog clana
  - POST /users/login - login (JWT token)
  - GET /users/profile - profil ulogovanog korisnika
  - GET /users/:id - podatci o korisniku (interni poziv)
- **Baza:** users tabela (id, name, email, password_hash, role, created_at)
- **Komunikacija:** REST API (sinhrona)

### Mikroservis 2: Room Service (port 3002)
- **Odgovornost:** Upravljanje prostorijama i booth-ovima, prikaz dostupnosti
- **Endpointi:**
  - GET /rooms - lista svih prostorija
  - GET /rooms/:id - detalji prostorije
  - GET /rooms/:id/availability?date=YYYY-MM-DD - dostupni slotovi
  - GET /rooms/available-now - prostorije slobodne trenutno
- **Baza:** rooms tabela (id, name, type [meeting_room|phone_booth], capacity, amenities, status)
- **Komunikacija:**
  - REST API (sinhrona - za upite)
  - Reaktivna komunikacija (SSE - Server-Sent Events) za real-time azuriranje dostupnosti

### Mikroservis 3: Booking Service (port 3003)
- **Odgovornost:** Kreiranje, otkazivanje i pregled rezervacija
- **Endpointi:**
  - POST /bookings - nova rezervacija
  - GET /bookings - sve rezervacije ulogovanog korisnika
  - GET /bookings/:id - detalji rezervacije
  - DELETE /bookings/:id - otkazivanje rezervacije
  - GET /bookings/room/:roomId?date=YYYY-MM-DD - sve rezervacije za prostoriju
- **Baza:** bookings tabela (id, user_id, room_id, date, start_time, end_time, status, created_at)
- **Komunikacija:**
  - REST API (sinhrona - ka Room Service za proveru dostupnosti)
  - RabbitMQ (asinhrona - salje event nakon uspesne rezervacije/otkazivanja)
- **Biznis logika:**
  - Provera da li je slot slobodan pre bukinga
  - Korisnik bira start_time i end_time (min 30min, korak 30min)
  - Jedan korisnik ne moze imati preklapajuce rezervacije
  - Max 3 aktivne rezervacije po korisniku dnevno
  - Dostupno 24h (nema ogranicenja radnog vremena)

### Mikroservis 4: Notification Service (port 3004)
- **Odgovornost:** Slanje obavestenja korisnicima
- **Endpointi:**
  - GET /notifications - obavestenja za ulogovanog korisnika
  - PATCH /notifications/:id/read - oznaci kao procitano
- **Komunikacija:**
  - RabbitMQ (prima event-e od Booking Service-a)
  - REST API (za citanje obavestenja)
- **Funkcije:**
  - Prima booking_created event -> kreira obavestenje "Uspesno ste rezervisali..."
  - Prima booking_cancelled event -> kreira obavestenje "Rezervacija otkazana..."
  - Cuva obavestenja u bazi za prikaz korisniku

### API Gateway (port 3000)
- **Odgovornost:** Rutiranje zahteva, autentifikacija, rate limiting
- **Funkcije:**
  - Prosledjuje zahteve ka odgovarajucem servisu
  - JWT validacija na zastićenim rutama
  - Rate limiting (max 100 zahteva po minutu)
  - Request logging
  - Health check endpoint: GET /health

---

## Tipovi komunikacije izmedju servisa (zahtev iz specifikacije)

| Tip komunikacije | Gde se koristi | Opis |
|---|---|---|
| **REST API** | Gateway <-> svi servisi, Booking <-> Room Service | Sinhroni HTTP pozivi |
| **Message Queue (RabbitMQ)** | Booking Service -> Notification Service | Asinhroni event-driven (booking_created, booking_cancelled) |
| **Reaktivna komunikacija (SSE)** | Room Service -> klijent (preko Gateway-a) | Real-time stream dostupnosti prostorija |

---

## FAZE PROJEKTA I STATUS

### FAZA 0: Inicijalizacija projekta
- **Opis:** Kreiranje repozitorijuma, osnovna struktura, inicijalni setup
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] Klonirati/inicijalizovati GitHub repo
  - [x] Kreirati osnovnu folder strukturu (monorepo)
  - [x] Inicijalizovati NestJS projekte za svaki servis
  - [x] Podesiti .gitignore
  - [x] Kreirati prvi feature branch i PR -> PR #1
  - [x] Napisati osnovni README.md
  - [x] Instalirati razvojne alate (VS Code, GitHub CLI)

### FAZA 1: Razvoj mikroservisa (Core aplikacija)
- **Opis:** Implementacija svih 4 servisa + API Gateway
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] User Service - CRUD + JWT auth
  - [x] Room Service - CRUD + SSE za dostupnost
  - [x] Booking Service - rezervacije + RabbitMQ publisher
  - [x] Notification Service - RabbitMQ consumer + obavestenja
  - [x] API Gateway - routing + auth middleware
  - [x] Povezivanje sa PostgreSQL bazom (TypeORM konfiguracija)
  - [x] Seed podatci:
    - Meeting Room 1 "Small" (6-8 osoba, Smart TV, bela tabla)
    - Meeting Room 2 "Large" (do 20 osoba, Smart TV, bela tabla)
    - Phone Booth 1-6 (1 osoba)

### FAZA 2: Testiranje
- **Opis:** Unit testovi i E2E testovi
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] Unit testovi za User Service (8 testova)
  - [x] Unit testovi za Booking Service (15 testova - biznis logika)
  - [x] Unit testovi za Room Service (9 testova)
  - [x] Unit testovi za Notification Service (7 testova)
  - [x] Unit testovi za API Gateway (1 test)
  - [x] E2E testovi za Booking Service (20 testova - HTTP endpoints + RabbitMQ)
  - [x] E2E testovi za User Service (14 testova - register, login, JWT, profile)
  - [x] Svi testovi prolaze (74/74 - 40 unit + 34 E2E)

### FAZA 3: Docker kontejnerizacija
- **Opis:** Dockerfile za svaki servis, Docker Compose za orkestraciju
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] Dockerfile za svaki mikroservis (multi-stage build: builder + production)
  - [x] .dockerignore za svaki servis
  - [x] docker-compose.yml sa 9 servisa (5 NestJS + PostgreSQL + RabbitMQ + Prometheus + Grafana)
  - [x] Definisati network (coworking-network), volumes, environment varijable
  - [x] Healthcheck za postgres i rabbitmq
  - [x] Dependency chain: service_healthy uslovi
  - [ ] Testirati lokalni build (Docker Desktop instaliran, ceka inicijalizaciju)

### FAZA 4: CI pipeline (GitHub Actions)
- **Opis:** Automatski build i testiranje na svaki push/PR
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] ci.yml workflow - build svih servisa (matrix strategija - paralelno)
  - [x] ESLint lint korak u pipeline-u
  - [x] Pokretanje svih unit testova u pipeline-u
  - [x] Docker build verifikacija u CI
  - [x] Pipeline se trigeruje na push i PR
  - [x] CI prolazi uspesno (zeleni checkmark)

### FAZA 5: Staticka analiza koda
- **Opis:** ESLint konfiguracija i integracija u CI
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] ESLint konfiguracija za sve servise (eslint.config.mjs - flat config v9)
  - [x] TypeScript ESLint + Prettier integracija
  - [x] Prilagodjena pravila za NestJS (iskljuceni no-unsafe-* za proxy pattern)
  - [x] Integracija u CI pipeline (lint korak pre build-a)
  - [x] 0 errors u svim servisima

### FAZA 6: CD pipeline + Deployment
- **Opis:** Automatski deploy na merge u main
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] cd.yml workflow - deploy verifikacija na merge u main
  - [x] Pre-deploy testovi
  - [x] Docker image build sa latest + SHA tagovima
  - [x] Docker Compose config validacija
  - [x] Full stack startup verifikacija + health check
  - [ ] Pravi deploy lokalno (nakon sto Docker Desktop bude spreman)

### FAZA 7: Monitoring i Observability
- **Opis:** Prometheus + Grafana za metrike
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] prom-client biblioteka u svim servisima
  - [x] MetricsController sa /metrics endpoint (svaki servis)
  - [x] Prometheus konfiguracija za scraping svih 5 servisa (15s interval)
  - [x] Grafana provisioning (datasource + dashboard provider)
  - [x] Grafana dashboard sa 5 panela (request rate, latency, errors, connections, gauge)
  - [x] Sve integrisano u Docker Compose (prometheus:9090, grafana:3100)

### FAZA 8: Dokumentacija i priprema za odbranu
- **Opis:** Projektna dokumentacija, finalni pregled
- **Status:** ✅ ZAVRSENO
- **Zadaci:**
  - [x] README.md sa uputstvom za pokretanje (kompletno: arhitektura, API, primeri, pokretanje)
  - [x] Arhitekturni dijagram (ASCII u README)
  - [x] Opis svakog servisa sa portovima i komunikacijom
  - [x] Uputstvo za CI/CD pipeline
  - [x] OBJASNJENJA_PROJEKTA.md - poglavlja 14-18 (Docker, CI, ESLint, CD, Monitoring)
  - [x] Priprema za demonstraciju DevOps workflow-a (vodic dodat ispod)
  - [ ] Slanje dokumentacije asistentima (3 dana pre odbrane)

### Vodic za demonstraciju na odbrani (redosled):
```
1. Pokazi GitHub repo -> Pull Requests (6 PR-ova), CI/CD Actions (zeleni checkmarks)
2. Pokazi arhitekturu (README.md dijagram) - objasni mikroservise i portove
3. Pokazi docker-compose.yml - objasni sta su kontejneri, mreza, volumes
4. Pokreni aplikaciju: docker compose up --build -d
5. Pokazi docker compose ps - svih 9 kontejnera running
6. Demonstracija API-ja (Postman/curl):
   a. POST /api/users/register
   b. POST /api/users/login -> dobijas JWT token
   c. GET /api/rooms -> lista prostorija
   d. POST /api/bookings -> kreiranje rezervacije (sa JWT)
   e. GET /api/notifications -> obavestenje stiglo (RabbitMQ!)
7. Pokazi Grafana dashboard: http://localhost:3100
8. Pokazi Prometheus: http://localhost:9090
9. Pokazi RabbitMQ management: http://localhost:15672
10. Pokreni unit testove: cd booking-service && npx jest
```

### Kljucne tacke za objasniti:
- **Zasto mikroservisi?** Svaki servis ima jednu odgovornost (SRP), mogu se nezavisno skalirati
- **Zasto RabbitMQ?** Decouple-ovanje - Booking ne mora da zna za Notification, samo salje event
- **Zasto SSE?** Real-time azuriranje dostupnosti bez pollinga
- **Zasto JWT?** Stateless autentifikacija - Gateway validira, servisi su nezavisni
- **Zasto Docker?** Reproduktivnost - radi isto na svakom racunaru
- **Zasto CI/CD?** Automatska verifikacija - svaki push prolazi testove pre mergea

---

## DNEVNIK RADA (LOG)

### Format zapisa:
```
## [DATUM] - Faza X - Naziv aktivnosti
**Sta je uradjeno:** Opis
**Gde:** Fajlovi/folderi
**Kako:** Tehnicko objasnjenje
**Zasto:** Razlog/cilj
**Rezultat:** Sta sada radi/ne radi
**Sledeci korak:** Sta treba dalje
```

### [2026-02-18] - Faza 0 - Inicijalizacija projekta
**Sta je uradjeno:**
- Instalirani razvojni alati: VS Code, GitHub CLI (gh)
- Ulogovana na GitHub kao `andjelalukicc`
- Kloniran repo `IROIT-2025/iroit-grupa-3-4-andjelalukicc` u folder `coworking-booking-system` na Desktop-u
- Obrisan stari Java Bookstore starter projekat (pom.xml, src/, .mvn/)
- Inicijalizovano 5 NestJS projekata sa TypeScript-om:
  - api-gateway (port 3000)
  - user-service (port 3001)
  - room-service (port 3002)
  - booking-service (port 3003)
  - notification-service (port 3004)
- Instalirane npm dependencies za svaki servis
- Kreiran `.gitignore` (node_modules, dist, .env, IDE fajlovi)
- Kreiran `README.md` sa opisom projekta i arhitekture
- Kreirana folder struktura za CI/CD (.github/workflows) i monitoring (prometheus/, grafana/)

**Gde:** `/Users/andjelalukic/Desktop/coworking-booking-system/`

**Kako:**
- `nest new <ime-servisa>` za svaki servis (NestJS CLI)
- Svaki servis ima svoj `package.json`, `tsconfig.json`, `src/` folder
- Portovi podeseni u `src/main.ts` svakog servisa

**Zasto:**
- Monorepo struktura - svi servisi u jednom repo-u, lakse za upravljanje
- NestJS izabran jer ima ugradjen dependency injection, modularnu arhitekturu i odlicnu podrsku za mikroservise
- Svaki servis na posebnom portu da mogu da rade paralelno

**Rezultat:**
- Svih 5 servisa kompajliraju bez gresaka (TypeScript check prosao)
- Feature branch `feature/initial-project-setup` pushovan
- PR #1 kreiran: https://github.com/IROIT-2025/iroit-grupa-3-4-andjelalukicc/pull/1

**Sledeci korak:** Faza 1 - Implementacija User Service-a (registracija, login, JWT)

---

### [2026-02-18] - Faza 1 - Implementacija svih mikroservisa
**Sta je uradjeno:**
Kompletna implementacija svih 5 servisa sa biznis logikom:

1. **User Service** (`user-service/src/users/`):
   - `user.entity.ts` - model korisnika (id, name, email, password, role)
   - `users.service.ts` - registracija sa bcrypt hashom, login validacija, pretraga po ID/email
   - `users.controller.ts` - POST /register, POST /login, GET /profile (zasticen), GET /:id
   - `dto/register.dto.ts` + `dto/login.dto.ts` - validacija input-a
   - `auth/jwt.strategy.ts` + `jwt-auth.guard.ts` - JWT autentifikacija

2. **Room Service** (`room-service/src/rooms/`):
   - `room.entity.ts` - model prostorije (name, type, capacity, amenities)
   - `rooms.service.ts` - CRUD + automatski seed 8 prostorija (2 meeting + 6 booth)
   - `rooms.controller.ts` - GET /rooms, GET /rooms/:id, GET /rooms/type/:type, SSE /rooms/availability/stream
   - SSE (Server-Sent Events) za reaktivnu komunikaciju

3. **Booking Service** (`booking-service/src/bookings/`):
   - `booking.entity.ts` - model rezervacije (userId, roomId, date, startTime, endTime, status)
   - `bookings.service.ts` - kreiranje/otkazivanje sa validacijom:
     - Min 30 min, koraci po 30 min
     - Max 3 rezervacije dnevno
     - Provera preklapanja po prostoriji I po korisniku
     - RabbitMQ emit (booking_created, booking_cancelled)
   - `bookings.controller.ts` - POST, GET, DELETE sa x-user-id header-om

4. **Notification Service** (`notification-service/src/notifications/`):
   - `notification.entity.ts` - model obavestenja
   - `notifications.service.ts` - kreiranje iz RabbitMQ event-a
   - `notifications.controller.ts` - @EventPattern za booking_created/cancelled + REST za citanje
   - `main.ts` - hybrid app (HTTP + RabbitMQ consumer)

5. **API Gateway** (`api-gateway/src/`):
   - Proxy routing ka svim servisima
   - JWT zastita na /bookings, /notifications, /users/profile
   - Javne rute: /register, /login, /rooms
   - Health endpoint: GET /health
   - Prosledjivanje x-user-id header-a

**Gde:** Svaki servis u svom folderu u monorepo-u

**Kako:**
- TypeORM za bazu (PostgreSQL) sa auto-sync
- JWT (JSON Web Token) za autentifikaciju - 24h istice
- RabbitMQ za async komunikaciju (Booking -> Notification)
- SSE za real-time stream (Room Service)
- class-validator za validaciju DTO-ova
- bcrypt za hashovanje lozinki

**Zasto:**
- Svaki servis ima jednu odgovornost (Single Responsibility)
- Gateway pattern - klijent komunicira samo sa jednim entry point-om
- RabbitMQ decoupling - Booking ne mora da zna za Notification, samo salje event
- SSE za reaktivnu komunikaciju (zahtev iz specifikacije)

**Rezultat:**
- Svih 5 servisa kompajliraju bez gresaka
- Commit pushovan na feature/initial-project-setup

**Sledeci korak:** Faza 2 - Testiranje (unit + e2e testovi)

---

### [2026-02-19] - Faza 2 - Unit testovi (36 testova)
**Sta je uradjeno:**
Napisani unit testovi za svih 5 servisa koristeci Jest framework sa mock repozitorijumima:

1. **User Service** (`users.service.spec.ts`) - 7 testova:
   - Uspesna registracija novog korisnika
   - Registracija sa vec postojecim email-om (ConflictException)
   - Validacija korisnika sa ispravnim podacima
   - Validacija sa pogresnom lozinkom (vraca null)
   - Validacija nepostojeceg korisnika (vraca null)
   - Pronalazenje korisnika po ID-u (bez lozinke u rezultatu)
   - Pronalazenje nepostojeceg korisnika (UnauthorizedException)

2. **Booking Service** (`bookings.service.spec.ts`) - 14 testova:
   - Kreiranje validne rezervacije + RabbitMQ event
   - Greska: endTime pre startTime
   - Greska: trajanje manje od 30 minuta
   - Greska: vremena nisu u intervalima od 30 min
   - Greska: korisnik vec ima 3 rezervacije taj dan
   - Greska: preklapanje sa postojecom rezervacijom sobe
   - Greska: preklapanje sa korisnikovom drugom rezervacijom
   - Dozvoljena rezervacija od 2 sata
   - Uspesno otkazivanje + RabbitMQ event
   - Pokusaj otkazivanja tudje rezervacije (BadRequestException)
   - Pokusaj otkazivanja vec otkazane rezervacije
   - Otkazivanje nepostojece rezervacije (NotFoundException)
   - Pretraga rezervacija po korisniku
   - Pretraga rezervacija po sobi i datumu

3. **Room Service** (`rooms.service.spec.ts`) - 8 testova:
   - Pronalazenje svih aktivnih prostorija
   - Pronalazenje prostorije po ID-u
   - Nepostojeca prostorija (NotFoundException)
   - Filtriranje po tipu: meeting_room
   - Filtriranje po tipu: phone_booth
   - Seed: kreiranje 8 prostorija u praznu tabelu
   - Seed: preskakanje ako prostorije vec postoje
   - SSE availability stream emitovanje dogadjaja

4. **Notification Service** (`notifications.service.spec.ts`) - 6 testova:
   - Kreiranje notifikacije
   - Dohvatanje notifikacija po korisniku (sortirano DESC)
   - Oznacavanje notifikacije kao procitane
   - Nepostojeca notifikacija (NotFoundException)
   - Obrada booking_created dogadjaja
   - Obrada booking_cancelled dogadjaja

5. **API Gateway** (`app.controller.spec.ts`) - 1 test:
   - Health endpoint vraca status sa listom servisa

**Gde:** Svaki test fajl je u `src/` folderu svog servisa pored implementacije (`.spec.ts` konvencija)

**Kako:**
- Jest framework (dolazi sa NestJS)
- Mock repozitorijumi - zamenjuju pravu bazu u memoriji (`jest.fn()`)
- Mock RabbitMQ klijent za testiranje event emitovanja
- Mock QueryBuilder za testiranje overlap detekcije
- `beforeEach` - resetuje mock-ove pre svakog testa za izolaciju
- bcrypt se koristi u testovima za verifikaciju hash-a lozinke

**Zasto:**
- Unit testovi su zahtev iz specifikacije projekta
- Testiramo biznis logiku BEZ infrastrukture (baze, message broker-a)
- Mock-ovi obezbedjuju brze i pouzdane testove (ne zavise od servera)
- Pokrivamo happy path (uspesni scenariji) i edge cases (greske, validacije)

**Rezultat:**
- 36/36 testova prolazi u svim servisima
- Commit `d9a3d93` pushovan na feature/initial-project-setup

**Sledeci korak:** Faza 3 - Docker kontejnerizacija

---

### [2026-02-19] - Faza 3 - Docker kontejnerizacija
**Sta je uradjeno:**
- Kreiran multi-stage Dockerfile za svaki od 5 servisa
- Kreiran .dockerignore za svaki servis
- Kreiran docker-compose.yml sa 9 servisa:
  - 5 NestJS mikroservisa
  - PostgreSQL 16 (baza podataka)
  - RabbitMQ 3 sa management UI-jem
  - Prometheus (monitoring)
  - Grafana (dashboard-i)
- Instaliran Docker Desktop na macOS

**Kako:**
- Multi-stage build: Faza 1 (builder) kompajlira TypeScript, Faza 2 (production) sadrzi samo dist/ i produkcione zavisnosti
- Healthcheck za postgres (pg_isready) i rabbitmq (diagnostics ping)
- Service dependency: servisi cekaju da baza bude zdrava pre startovanja
- Docker mreža (coworking-network) za interni saobracaj

**Rezultat:**
- 11 novih fajlova (5 Dockerfile + 5 .dockerignore + 1 docker-compose.yml)
- Commit `135ed4a` pushovan

---

### [2026-02-19] - Faza 4 - CI pipeline (GitHub Actions)
**Sta je uradjeno:**
- Kreiran `.github/workflows/ci.yml` sa matrix strategijom
- Pipeline se pokrece na svaki push i PR

**Koraci pipeline-a:**
1. Checkout koda
2. Setup Node.js 22
3. Cache node_modules (ubrzava build)
4. npm install
5. ESLint lint (staticka analiza)
6. npm run build (TypeScript kompilacija)
7. npx jest (unit testovi)
8. Docker image build (verifikacija)

**Rezultat:**
- CI pipeline prolazi uspesno (zeleni checkmark na GitHub-u)
- Paralelno se izvrsava za svih 5 servisa (matrix)

---

### [2026-02-19] - Faza 5 - Staticka analiza koda (ESLint)
**Sta je uradjeno:**
- ESLint vec konfigurisan od NestJS-a (eslint.config.mjs - flat config v9)
- Prilagodjena pravila za nas projekat:
  - Iskljuceni `no-unsafe-*` jer proxy pattern zahteva `any` tipove
  - Dodat `ignoreRestSiblings` za destructuring (password uklanjanje)
  - Prettier integracija za formatiranje koda
- Pokrenuti auto-fix za sve servise
- Popravljene prave greske (neiskoristeni importi, varijable)

**Rezultat:**
- 0 errors u svih 5 servisa
- Samo warnings (no-floating-promises, no-unsafe-argument) koji ne blokiraju CI
- ESLint integrisam u CI pipeline (korak pre build-a)

---

### [2026-02-19] - Faza 6 - CD pipeline
**Sta je uradjeno:**
- Kreiran `.github/workflows/cd.yml`
- Pokrece se na merge u main granu

**Koraci:**
1. Pre-deploy testovi (svih 5 servisa)
2. Docker image build sa dva taga: `latest` + commit SHA
3. Docker Compose config validacija
4. Full stack pokretanje u CI
5. Health check API Gateway-a
6. Cleanup (docker compose down -v)

---

### [2026-02-19] - Faza 7 - Monitoring (Prometheus + Grafana)
**Sta je uradjeno:**
- Instaliran `prom-client` u svaki servis
- Kreiran `MetricsController` sa GET /metrics endpoint
- Prometheus konfig: scrape svakih 15s sa svih 5 servisa
- Grafana provisioning: auto-konfiguracija datasource + dashboards
- Grafana dashboard sa 5 panela:
  1. HTTP request rate po servisu (line chart)
  2. Latency percentili p50/p95/p99 (line chart, color-coded)
  3. Error rate 4xx/5xx (stacked bars)
  4. Active connections (line chart)
  5. Current request rate (gauge)
- Dodati prometheus i grafana u docker-compose.yml

**Pristup:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3100 (admin/admin)

**Rezultat:**
- Commit `d3d5448` pushovan
- Svi testovi i dalje prolaze (36/36)

---

### [2026-02-20] - Faza 8 - Dokumentacija i priprema za odbranu
**Sta je uradjeno:**
- Kompletno prepisan README.md sa svim sekcijama:
  - Opis aplikacije i pravila rezervacije
  - Arhitekturni dijagram (ASCII)
  - Tabela servisa sa portovima
  - Tipovi komunikacije (REST, RabbitMQ, SSE)
  - Tech stack tabela
  - Kompletno uputstvo za pokretanje (Docker Compose)
  - Svi API endpointi (javni + zasticeni)
  - Primeri koristenja sa curl komandama
  - Testiranje (unit + staticka analiza)
  - CI/CD pipeline opis
  - Monitoring (Prometheus + Grafana)
  - Kompletna struktura projekta (tree view)
  - Git workflow
- Azuriran OBJASNJENJA_PROJEKTA.md - dodato 5 novih poglavlja:
  - Poglavlje 14: Docker (Dockerfile, multi-stage, docker-compose, kontejneri)
  - Poglavlje 15: CI Pipeline (GitHub Actions, matrix, cache)
  - Poglavlje 16: Staticka analiza (ESLint, Prettier, pravila)
  - Poglavlje 17: CD Pipeline (deploy, tagovi, verifikacija)
  - Poglavlje 18: Monitoring (prom-client, Prometheus, Grafana, dashboard)

**Rezultat:**
- README.md spreman za profesore/asistente
- OBJASNJENJA kompletna za razumevanje svih faza projekta

---

### [2026-02-22] - Finalni pregled i priprema za odbranu
**Sta je uradjeno:**
- Pregled celokupnog projekta i dokumentacije
- Uklonjen zastareli `version: '3.8'` atribut iz docker-compose.yml (pravio warning)
- Dodat vodic za demonstraciju na odbrani u master dokumentaciju (redosled koraka + kljucne tacke za objasnjenje)
- Azuriran PROJEKAT_MASTER_DOC.md - Faza 8 oznacena kompletno

**Gde:** `/Users/andjelalukic/Desktop/coworking-booking-system/docker-compose.yml`

**Kako:**
- `version` polje u docker-compose.yml je zastarelo od Docker Compose v2+ - automatski se detektuje format
- Uklanjanjem tog polja eliminise se warning pri svakom `docker compose` pozivu

**Zasto:**
- Cist docker-compose.yml bez deprecation warning-a = profesionalniji projekat
- Vodic za demonstraciju pomaze strukturiranom pokazivanju projekta na odbrani

**Rezultat:**
- docker-compose.yml vise ne prikazuje warning
- Projekat je 100% spreman za odbranu

**Preostalo:**
- [x] Pokrenuti docker compose up --build lokalno i verifikovati da sve radi - RADI SAVRSENO
- [ ] Poslati mejl asistentima 3 dana pre odbrane (sofijadjordjevic@uns.ac.rs, masa.saranovic@uns.ac.rs)

**Verifikacija lokalnog deploya (2026-02-22):**
- GET /health -> status: ok, sva 4 servisa online
- POST /api/users/register -> korisnik kreiran
- POST /api/users/login -> JWT token dobijen
- GET /api/rooms -> 8 prostorija (2 meeting + 6 phone booth)
- POST /api/bookings -> rezervacija kreirana (status: active)
- GET /api/notifications -> notifikacija stigla via RabbitMQ (booking_confirmed)
- Svih 9 kontejnera healthy: postgres, rabbitmq, user-service, room-service, booking-service, notification-service, api-gateway, prometheus, grafana

---

## TEHNICKE NAPOMENE

### Folder struktura (planirana):
```
coworking-booking-system/
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── api-gateway/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── user-service/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── room-service/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── booking-service/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── notification-service/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── prometheus/
│   └── prometheus.yml
├── grafana/
│   └── dashboards/
└── README.md
```

### Portovi:
| Servis | Port |
|---|---|
| API Gateway | 3000 |
| User Service | 3001 |
| Room Service | 3002 |
| Booking Service | 3003 |
| Notification Service | 3004 |
| PostgreSQL | 5432 |
| RabbitMQ | 5672 (amqp), 15672 (management UI) |
| Prometheus | 9090 |
| Grafana | 3100 |

### Environment varijable (primer):
```
DATABASE_URL=postgresql://user:pass@postgres:5432/coworking
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
JWT_SECRET=your-secret-key
NODE_ENV=production
```

---

## PREDAJA PROJEKTA - Checklist
- [x] Link ka Git repozitorijumu: https://github.com/IROIT-2025/iroit-grupa-3-4-andjelalukicc
- [x] Istorija pull request-ova (6 PR-ova - prelazi minimum od 5):
  - PR #1: Initialize NestJS microservices architecture (MERGED)
  - PR #2: Add health check endpoints to all microservices (MERGED)
  - PR #3: Add Swagger/OpenAPI documentation (MERGED)
  - PR #4: Add E2E integration tests - 34 testova (MERGED)
  - PR #5: Add CORS support and request logging (MERGED)
  - PR #6: Add global validation pipe and exception filter (MERGED)
- [x] Link ka deploy-ovanoj aplikaciji (lokalni Docker) - verifikovano 2026-02-22
- [x] Projektna dokumentacija (README.md + OBJASNJENJA)
- [ ] Poslati mejl asistentima 3 dana pre odbrane:
  - sofijadjordjevic@uns.ac.rs
  - masa.saranovic@uns.ac.rs
