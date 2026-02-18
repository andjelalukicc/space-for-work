# Coworking Booking System

Mikroservisna aplikacija za rezervaciju meeting room-ova i phone booth-ova u coworking prostoru.

## Opis

Sistem omogucava clanovima coworking prostora da rezervisu prostorije za sastanke, pozive ili fokus rad. Dostupno 24h, sa fleksibilnim trajanjem rezervacije (minimum 30 minuta).

### Prostorije
| Prostorija | Kapacitet | Oprema |
|---|---|---|
| Meeting Room 1 "Small" | 6-8 osoba | Smart TV, bela tabla |
| Meeting Room 2 "Large" | do 20 osoba | Smart TV, bela tabla |
| Phone Booth 1-6 | 1 osoba | Zvucna izolacija |

## Arhitektura

Aplikacija se sastoji od 5 mikroservisa:

| Servis | Port | Opis |
|---|---|---|
| API Gateway | 3000 | Rutiranje, autentifikacija, rate limiting |
| User Service | 3001 | Registracija, login, upravljanje korisnicima |
| Room Service | 3002 | Upravljanje prostorijama, dostupnost |
| Booking Service | 3003 | Kreiranje i upravljanje rezervacijama |
| Notification Service | 3004 | Obavestenja o rezervacijama |

### Komunikacija izmedju servisa
- **REST API** - sinhrona komunikacija (Gateway <-> servisi)
- **RabbitMQ** - asinhrona komunikacija (Booking -> Notification)
- **SSE (Server-Sent Events)** - reaktivna komunikacija za real-time dostupnost

### Infrastruktura
- **PostgreSQL** - baza podataka
- **RabbitMQ** - message broker
- **Prometheus + Grafana** - monitoring i observability

## Tech Stack

- **Runtime:** Node.js
- **Framework:** NestJS (TypeScript)
- **Baza:** PostgreSQL + TypeORM
- **Message Broker:** RabbitMQ
- **Kontejnerizacija:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana

## Pokretanje

### Lokalno (development)
```bash
# Instalacija dependencies za svaki servis
cd api-gateway && npm install
cd user-service && npm install
cd room-service && npm install
cd booking-service && npm install
cd notification-service && npm install
```

### Docker (production)
```bash
docker compose up --build
```

## Struktura projekta
```
coworking-booking-system/
├── api-gateway/          # API Gateway servis
├── user-service/         # User Management servis
├── room-service/         # Room Management servis
├── booking-service/      # Booking Management servis
├── notification-service/ # Notification servis
├── prometheus/           # Prometheus konfiguracija
├── grafana/              # Grafana dashboards
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yml    # Docker orkestracija
└── README.md
```

## Autor
Andjela Lukic - IT62/2022
