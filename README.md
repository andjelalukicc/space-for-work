# Coworking Booking System

Mikroservisna aplikacija za rezervaciju meeting room-ova i phone booth-ova u coworking prostoru.

**Predmet:** Integracije (IROIT) - DevOps projekat
**Student:** Andjela Lukic - IT62/2022

---

## Opis aplikacije

Sistem omogucava clanovima coworking prostora da rezervisu prostorije za sastanke, pozive ili fokus rad.

### Prostorije
| Prostorija | Tip | Kapacitet | Oprema |
|---|---|---|---|
| Meeting Room 1 "Small" | meeting_room | 6-8 osoba | Smart TV, bela tabla |
| Meeting Room 2 "Large" | meeting_room | do 20 osoba | Smart TV, bela tabla |
| Phone Booth 1-6 | phone_booth | 1 osoba | Zvucna izolacija |

### Pravila rezervacije
- Radno vreme: **24h (non-stop)**
- Minimalna rezervacija: **30 minuta**
- Korisnik bira trajanje (30min, 1h, 2h, itd.)
- Vremenski koraci: svakih 30 min (09:00, 09:30, 10:00...)
- Max **3 aktivne rezervacije** po korisniku dnevno
- Bez preklapanja rezervacija (ni za sobu, ni za korisnika)

---

## Arhitektura

Aplikacija koristi **mikroservisnu arhitekturu** sa 5 nezavisnih servisa:

```
                    ┌─────────────────┐
   Klijent -------> │   API Gateway   │ (port 3000)
                    │    (NestJS)     │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
   ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
   │  User Service │ │ Room Service │ │Booking Service│
   │   port 3001   │ │  port 3002   │ │  port 3003    │
   └───────────────┘ └──────────────┘ └───────┬───────┘
                                              │
                                        [RabbitMQ]
                                              │
                                    ┌─────────▼────────┐
                                    │Notification Svc  │
                                    │   port 3004      │
                                    └──────────────────┘

   Baza podataka: PostgreSQL 16
   Message Broker: RabbitMQ 3
   Monitoring: Prometheus + Grafana
```

### Servisi

| Servis | Port | Opis |
|---|---|---|
| **API Gateway** | 3000 | Jedina ulazna tacka - rutiranje, JWT autentifikacija |
| **User Service** | 3001 | Registracija, login, upravljanje korisnicima |
| **Room Service** | 3002 | Upravljanje prostorijama, SSE stream dostupnosti |
| **Booking Service** | 3003 | Kreiranje/otkazivanje rezervacija, biznis validacija |
| **Notification Service** | 3004 | Obavestenja o rezervacijama (RabbitMQ consumer) |

### Tipovi komunikacije izmedju servisa

| Tip | Gde se koristi | Opis |
|---|---|---|
| **REST API** (sinhrona) | Gateway <-> svi servisi | HTTP proxy zahtevi |
| **RabbitMQ** (asinhrona) | Booking -> Notification | Event-driven (booking_created, booking_cancelled) |
| **SSE** (reaktivna) | Room Service -> klijent | Server-Sent Events za real-time dostupnost |

---

## Tech Stack

| Kategorija | Tehnologija |
|---|---|
| Runtime | Node.js 22 |
| Framework | NestJS (TypeScript) |
| Baza podataka | PostgreSQL 16 + TypeORM |
| Message Broker | RabbitMQ 3 |
| Autentifikacija | JWT (JSON Web Token) + Passport.js |
| Kontejnerizacija | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Staticka analiza | ESLint v9 + Prettier |
| Monitoring | Prometheus + Grafana |
| Testiranje | Jest (36 unit testova) |

---

## Pokretanje aplikacije

### Preduslovi
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instaliran i pokrenut

### Pokretanje sa Docker Compose (preporuceno)
```bash
# Kloniraj repozitorijum
git clone https://github.com/IROIT-2025/iroit-grupa-3-4-andjelalukicc.git
cd iroit-grupa-3-4-andjelalukicc

# Prebaci se na feature branch
git checkout feature/initial-project-setup

# Pokreni sve servise (prvi put traje ~2-3 min)
docker compose up --build -d

# Proveri da li su svi kontejneri pokrenuti
docker compose ps
```

### Pristup servisima
| Servis | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3100 (admin/admin) |

### Zaustavljanje
```bash
# Zaustavi sve servise
docker compose down

# Zaustavi i obrisi podatke (volumes)
docker compose down -v
```

---

## API Endpointi

Svi zahtevi idu preko API Gateway-a na `http://localhost:3000`.

### Javni endpointi (ne zahtevaju JWT)
```
POST /api/users/register     - Registracija novog korisnika
POST /api/users/login        - Login (vraca JWT token)
GET  /api/rooms              - Lista svih prostorija
GET  /api/rooms/:id          - Detalji prostorije
GET  /api/rooms/type/:type   - Prostorije po tipu (meeting_room, phone_booth)
GET  /health                 - Health check
```

### Zasticeni endpointi (zahtevaju JWT token)
```
GET    /api/users/profile         - Profil ulogovanog korisnika
POST   /api/bookings              - Nova rezervacija
GET    /api/bookings              - Moje rezervacije
GET    /api/bookings/:id          - Detalji rezervacije
DELETE /api/bookings/:id          - Otkazivanje rezervacije
GET    /api/notifications         - Moja obavestenja
PATCH  /api/notifications/:id/read - Oznaci obavestenje kao procitano
```

### Primer koristenja (Postman ili curl)

**1. Registracija:**
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Andjela","email":"andjela@test.com","password":"lozinka123"}'
```

**2. Login (dobijas JWT token):**
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"andjela@test.com","password":"lozinka123"}'
```
Odgovor: `{"access_token":"eyJhbGciOi..."}`

**3. Pregled prostorija:**
```bash
curl http://localhost:3000/api/rooms
```

**4. Kreiranje rezervacije (treba JWT):**
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tvoj-token>" \
  -d '{"roomId":"<room-id>","date":"2026-02-20","startTime":"10:00","endTime":"11:30"}'
```

**5. Moje rezervacije (treba JWT):**
```bash
curl http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <tvoj-token>"
```

---

## Testiranje

### Unit testovi (36 testova)
```bash
# Pokreni testove za jedan servis
cd user-service && npx jest
cd booking-service && npx jest
cd room-service && npx jest
cd notification-service && npx jest
cd api-gateway && npx jest
```

| Servis | Testova | Pokriva |
|---|---|---|
| User Service | 7 | Registracija, login, validacija, JWT |
| Booking Service | 14 | Kreiranje, otkazivanje, preklapanje, limiti |
| Room Service | 8 | CRUD, seed, SSE stream, filtriranje |
| Notification Service | 6 | Kreiranje, citanje, RabbitMQ eventi |
| API Gateway | 1 | Health endpoint |
| **Ukupno** | **36** | |

### Staticka analiza
```bash
# Pokreni ESLint za jedan servis
cd user-service && npx eslint src/
```

---

## CI/CD Pipeline

### CI Pipeline (`.github/workflows/ci.yml`)
- **Trigger:** Svaki push i pull request
- **Koraci:** Checkout -> Node.js setup -> Cache -> Install -> ESLint -> Build -> Test -> Docker Build
- **Matrix:** Svih 5 servisa paralelno

### CD Pipeline (`.github/workflows/cd.yml`)
- **Trigger:** Push u main granu (merge PR-a)
- **Koraci:** Pre-deploy testovi -> Docker build sa tagovima -> Compose validacija -> Full stack verifikacija -> Health check

---

## Monitoring

### Prometheus (port 9090)
- Prikuplja metrike sa svih servisa svakih 15 sekundi
- Endpoint: `GET /metrics` na svakom servisu
- Metrike: CPU, memorija, event loop, HTTP zahtevi

### Grafana (port 3100)
- Login: admin/admin
- Dashboard: "Coworking System Overview"
- Paneli: Request rate, Latency percentiles, Error rate, Active connections, Current rate gauge

---

## Struktura projekta
```
coworking-booking-system/
├── api-gateway/              # API Gateway servis
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── eslint.config.mjs
│   ├── package.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── app.controller.ts       # Proxy routing
│       ├── metrics.controller.ts   # Prometheus metrike
│       └── auth/
│           ├── jwt.strategy.ts
│           └── jwt-auth.guard.ts
├── user-service/             # User Management servis
│   ├── Dockerfile
│   └── src/
│       └── users/
│           ├── user.entity.ts
│           ├── users.service.ts
│           ├── users.service.spec.ts   # 7 unit testova
│           ├── users.controller.ts
│           └── dto/
├── room-service/             # Room Management servis
│   ├── Dockerfile
│   └── src/
│       └── rooms/
│           ├── room.entity.ts
│           ├── rooms.service.ts        # + seed 8 prostorija
│           ├── rooms.service.spec.ts   # 8 unit testova
│           └── rooms.controller.ts     # + SSE stream
├── booking-service/          # Booking Management servis
│   ├── Dockerfile
│   └── src/
│       └── bookings/
│           ├── booking.entity.ts
│           ├── bookings.service.ts     # Biznis logika + RabbitMQ
│           ├── bookings.service.spec.ts # 14 unit testova
│           ├── bookings.controller.ts
│           └── dto/
├── notification-service/     # Notification servis
│   ├── Dockerfile
│   └── src/
│       └── notifications/
│           ├── notification.entity.ts
│           ├── notifications.service.ts
│           ├── notifications.service.spec.ts # 6 unit testova
│           └── notifications.controller.ts   # RabbitMQ consumer
├── prometheus/
│   └── prometheus.yml        # Scrape konfiguracija
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/datasource.yml
│   │   └── dashboards/dashboard.yml
│   └── dashboards/
│       └── coworking-overview.json
├── .github/workflows/
│   ├── ci.yml                # CI pipeline
│   └── cd.yml                # CD pipeline
├── docker-compose.yml        # Docker orkestracija (9 servisa)
└── README.md
```

---

## Git Workflow

- **Branching:** Feature branch (`feature/initial-project-setup`)
- **PR:** Pull Request #1 ka main grani
- **CI:** Automatski testovi na svaki push
- **CD:** Deploy verifikacija na merge u main

## Autor
Andjela Lukic - IT62/2022
Predmet: Integracije (IROIT), FTN Novi Sad
