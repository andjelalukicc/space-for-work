# Projektna dokumentacija

**Predmet:** Integracije — IROIT
**Student:** Andjela Lukić, IT62/2022
**GitHub repozitorijum:** https://github.com/IROIT-2025/iroit-grupa-3-4-andjelalukicc

---

## Sadržaj

1. Uvod
2. Opis aplikacije
3. Arhitektura sistema
4. Mikroservisi
5. Tipovi komunikacije između servisa
6. Baza podataka
7. Testiranje
8. Kontejnerizacija (Docker)
9. CI pipeline (GitHub Actions)
10. Statička analiza koda (ESLint)
11. CD pipeline i deployment
12. Monitoring (Prometheus i Grafana)
13. Zaključak

---

## 1. Uvod

Tema ovog projekta je izgradnja sistema za rezervaciju prostorija u coworking prostoru, realizovana kroz mikroservisnu arhitekturu. Cilj projekta bio je da se u praksi primene koncepti integracije sistema koji su obrađivani na predmetu, uključujući različite tipove komunikacije između servisa, automatizaciju procesa razvoja i monitoring aplikacije u produkciji.

Projekat je razvijen korišćenjem Node.js frejmvorka NestJS i pokreće se lokalno putem Docker Compose-a. Svaki servis je nezavisna aplikacija sa sopstvenom logikom i bazom podataka, a međusobno komuniciraju putem REST API-ja, message broker-a (RabbitMQ) i reaktivnih stream-ova (SSE).

---

## 2. Opis aplikacije

Aplikacija omogućava članovima coworking prostora da rezervišu meeting room-ove i phone booth-ove. Korisnik se registruje, uloguje i nakon toga može da pregleda dostupne prostorije i kreira rezervaciju.

U sistemu postoje sledeće prostorije:
- **Meeting Room 1 „Small"** — kapacitet 6–8 osoba, opremljen Smart TV-om i belom tablom
- **Meeting Room 2 „Large"** — kapacitet do 20 osoba, opremljen Smart TV-om i belom tablom
- **6 Phone Booth-ova** — za jednu osobu, namenjeni za pozive ili individualni fokus rad

Pravila koja sistem automatski proverava:
- Minimalno trajanje rezervacije je 30 minuta, a vremenski koraci su svakih 30 minuta (npr. 09:00, 09:30, 10:00...)
- Jedan korisnik ne može imati više od 3 aktivne rezervacije u istom danu
- Nije dozvoljeno da se rezervacije iste prostorije ili istog korisnika vremenski preklapaju
- Prostorije su dostupne 24 sata

---

## 3. Arhitektura sistema

Sistem je implementiran kao skup od 5 nezavisnih mikroservisa koji međusobno komuniciraju. Svaki servis ima jasno definisanu odgovornost i pokreće se na zasebnom portu. Klijent nikada ne komunicira direktno sa pojedinačnim servisima — sve zahteve prima API Gateway koji ih zatim prosleđuje odgovarajućem servisu.

```
              Klijent
                 │
         ┌───────▼────────┐
         │   API Gateway  │  port 3000
         └───────┬────────┘
                 │
    ┌────────────┼─────────────┐
    │            │             │
┌───▼───┐  ┌────▼───┐  ┌──────▼──────┐
│ User  │  │  Room  │  │   Booking   │
│ Svc   │  │  Svc   │  │   Service   │
│ :3001 │  │  :3002 │  │    :3003    │
└───────┘  └────────┘  └──────┬──────┘
                               │ RabbitMQ
                        ┌──────▼──────┐
                        │Notification │
                        │  Service   │
                        │   :3004    │
                        └────────────┘

PostgreSQL · RabbitMQ · Prometheus · Grafana
```

Ovakva arhitektura omogućava da svaki servis može da se razvija, testira i skalira nezavisno od ostalih. Na primer, ako bi u budućnosti trebalo dodati novi način notifikacije (SMS umesto in-app poruke), to se radi samo u Notification Service-u, bez ikakvih izmena u ostalim servisima.

---

## 4. Mikroservisi

### API Gateway (port 3000)

API Gateway je jedina tačka ulaska u sistem. Prima sve zahteve od klijenta, proverava JWT token na zaštićenim rutama i prosleđuje zahtev odgovarajućem servisu. Javne rute (registracija, login, lista prostorija) ne zahtevaju autentifikaciju, dok su rute za rezervacije i notifikacije zaštićene.

Gateway takođe dodaje `x-user-id` header u zahteve koje prosleđuje ka internim servisima, kako bi servisi znali koji korisnik je ulogovan, bez potrebe da ponovo dekodiraju JWT token.

### User Service (port 3001)

Ovaj servis zadužen je za upravljanje korisnicima. Podržava registraciju novog korisnika, login i pregled profila. Lozinka se nikada ne čuva u originalnom obliku — pre upisa u bazu prolazi kroz bcrypt hash funkciju. Nakon uspešnog login-a, generiše se JWT token koji važi 24 sata i koji klijent koristi za sve naredne zahteve.

### Room Service (port 3002)

Room Service upravljuje podacima o prostorijama. Kada se servis prvi put pokrene, automatski upisuje 8 prostorija u bazu (seed data): 2 meeting room-a i 6 phone booth-ova. Osim standardnih REST endpointa za listu i detalje prostorija, servis implementira i SSE (Server-Sent Events) stream koji klijentima šalje obaveštenja o promeni dostupnosti u realnom vremenu.

### Booking Service (port 3003)

Booking Service je najsloženiji deo sistema jer sadrži svu poslovnu logiku vezanu za rezervacije. Kada korisnik pokuša da napravi rezervaciju, servis proverava sledeće uslove: da li je prostorija slobodna u željenom terminu, da li korisnik već ima rezervaciju koja se preklapa i da li je dostignut dnevni limit od 3 rezervacije. Tek ako su svi uslovi ispunjeni, rezervacija se kreira. Nakon toga, servis šalje event putem RabbitMQ-a kako bi Notification Service bio obavešten.

### Notification Service (port 3004)

Ovaj servis radi kao hibridna aplikacija — istovremeno prima HTTP zahteve i sluša poruke sa RabbitMQ red-a. Kada Booking Service pošalje event `booking_created` ili `booking_cancelled`, Notification Service kreira odgovarajuće obaveštenje i čuva ga u bazi. Korisnik može da pročita svoja obaveštenja putem REST endpointa.

---

## 5. Tipovi komunikacije između servisa

Projekat implementira tri tipa komunikacije, prema zahtevima iz specifikacije.

### Sinhrona komunikacija — REST API

REST API koristi se za komunikaciju između API Gateway-a i svih internih servisa, kao i između Booking Service-a i Room Service-a (provera dostupnosti prostorije). Radi se o sinhronoj komunikaciji — servis šalje zahtev i čeka odgovor pre nego što nastavi sa obradom.

### Asinhrona komunikacija — RabbitMQ

RabbitMQ se koristi za komunikaciju između Booking Service-a i Notification Service-a. Nakon kreiranja ili otkazivanja rezervacije, Booking Service objavljuje event na RabbitMQ red, a Notification Service ga preuzima i obrađuje. Ova komunikacija je asinhrona — Booking Service ne čeka odgovor od Notification Service-a i ne mora da zna da on uopšte postoji. Ovakav pristup smanjuje međuzavisnost servisa i povećava otpornost sistema na greške.

### Reaktivna komunikacija — SSE (Server-Sent Events)

Server-Sent Events implementiran je u Room Service-u i omogućava klijentu da prima obaveštenja o promeni dostupnosti prostorija u realnom vremenu, bez potrebe da periodično šalje zahteve (polling). Klijent otvori jednu konekciju ka `/rooms/availability/stream` endpointu i server mu šalje podatke čim se nešto promeni.

---

## 6. Baza podataka

Koristi se jedna instanca PostgreSQL baze podataka, ali svaki servis radi isključivo sa sopstvenim tabelama. User Service koristi tabelu `users`, Room Service tabelu `rooms`, Booking Service tabelu `bookings`, a Notification Service tabelu `notifications`.

Mapiranje između TypeScript klasa i tabela u bazi odrađuje TypeORM biblioteka, koja automatski kreira tabele na osnovu definisanih entity klasa. Ovaj pristup se naziva code-first — schema baze se definiše u kodu, a ne ručno u SQL-u.

---

## 7. Testiranje

### Unit testovi

Unit testovi napisani su za svih 5 servisa korišćenjem Jest frejmvorka. Testovi pokrivaju poslovnu logiku servisa u izolaciji — umesto pravih baza i message broker-a, koriste se mock objekti koji simuliraju njihovo ponašanje. Na taj način testovi su brzi i ne zahtevaju pokrenute spoljne servise.

Ukupno je napisano **40 unit testova**:
- User Service: 7 testova (registracija, login, pretraga korisnika, greške)
- Booking Service: 14 testova (kreiranje rezervacije, svi rubni slučajevi validacije, otkazivanje)
- Room Service: 8 testova (lista prostorija, filtriranje po tipu, seed logika, SSE)
- Notification Service: 6 testova (kreiranje notifikacije, obrada event-a, čitanje)
- API Gateway: 1 test (health endpoint)

Posebna pažnja posvećena je testiranju rubnih slučajeva u Booking Service-u: što se dešava kada korisnik pokuša da rezerviše termin koji je zauzet, kada napravi rezervaciju kraću od 30 minuta, ili kada dostigne dnevni limit.

### E2E testovi (integracioni)

End-to-end testovi testiraju kompletne HTTP zahteve prema stvarnim endpointima, sa pravom bazom podataka. Napisano je **34 E2E testa**:
- Booking Service: 20 testova (HTTP endpointi za kreiranje, pregled i otkazivanje rezervacija, uključujući i verifikaciju RabbitMQ event-a)
- User Service: 14 testova (registracija, login, JWT validacija, zaštićeni profil endpoint)

Svi testovi prolaze: **74/74**.

---

## 8. Kontejnerizacija (Docker)

Svaki mikroservis ima sopstveni `Dockerfile` koji koristi multi-stage build pristup. U prvoj fazi (builder) kompajlira se TypeScript kod, a u drugoj fazi (production) u finalnu sliku kopira se samo kompajlirani JavaScript kod i produkcione zavisnosti. Na taj način finalne Docker slike su manje i bezbednije, jer ne sadrže razvojne alate ni izvorni kod.

Orchestracija svih servisa definisana je u `docker-compose.yml` fajlu koji pokreće ukupno 9 kontejnera: 5 NestJS mikroservisa, PostgreSQL, RabbitMQ, Prometheus i Grafana. Svi kontejneri nalaze se u zajedničkoj Docker mreži `coworking-network` što im omogućava međusobnu komunikaciju putem naziva servisa (npr. `postgres` umesto IP adrese).

Definisani su healthcheck-ovi za PostgreSQL i RabbitMQ, a NestJS servisi čekaju da infrastrukturni servisi budu potpuno pokrenuti pre nego što sami krenu sa radom.

Aplikacija se pokreće jednom komandom:

```bash
docker compose up -d
```

---

## 9. CI pipeline (GitHub Actions)

Svaki push na GitHub i svaki otvoreni Pull Request automatski pokreće CI (Continuous Integration) pipeline definisan u `.github/workflows/ci.yml`. Pipeline koristi matrix strategiju što znači da se svih 5 servisa build-uje i testira paralelno, čime se skraćuje vreme izvršavanja.

Koraci koji se izvršavaju za svaki servis:
1. Preuzimanje koda
2. Instalacija Node.js 22 i npm zavisnosti
3. Statička analiza koda (ESLint)
4. Kompilacija TypeScript koda
5. Pokretanje svih unit testova
6. Build Docker image-a (verifikacija da kontejner može da se napravi)

Na ovaj način, nijedan kod koji ne prolazi testove ili linting ne može da bude spojen u glavnu granu.

---

## 10. Statička analiza koda (ESLint)

ESLint je konfigurisanje za svih 5 servisa korišćenjem flat config formata (eslint.config.mjs), koji je standard od ESLint v9. Integrisan je TypeScript ESLint plugin i Prettier za formatiranje koda.

Pravila su prilagođena specifičnostima projekta — `no-unsafe-*` pravila su isključena za API Gateway jer proxy pattern inherentno zahteva rad sa `any` tipovima. Za sve ostale servise primenjena su standardna TypeScript ESLint pravila.

Rezultat statičke analize: **0 grešaka** u svih 5 servisa. ESLint se izvršava kao prvi korak u CI pipeline-u, pre build-a i testova.

---

## 11. CD pipeline i deployment

CD (Continuous Deployment) pipeline definisan je u `.github/workflows/cd.yml` i pokreće se automatski kada se kod spoji u `main` granu. Pipeline izvršava sledeće korake:

1. Pokretanje testova za sve servise (pre-deploy verifikacija)
2. Build Docker image-a sa dva taga: `latest` i commit SHA (za traceability)
3. Validacija Docker Compose konfiguracije
4. Pokretanje kompletnog stack-a i health check API Gateway-a
5. Gašenje stack-a nakon verifikacije

Aplikacija se deployi lokalno putem Docker Compose-a. Svih 9 kontejnera se uspešno pokreće i svi health check-ovi prolaze. API Gateway dostupan je na adresi `http://localhost:3000`, a Swagger dokumentacija na `http://localhost:3000/api`.

---

## 12. Monitoring (Prometheus i Grafana)

Svaki mikroservis eksponuje `/metrics` endpoint koji Prometheus periodično scrape-uje svakih 15 sekundi. Metrike se prikupljaju korišćenjem `prom-client` biblioteke i uključuju broj HTTP zahteva, latency po endpointu i broj aktivnih konekcija.

Grafana je konfigurisana sa auto-provisioning-om — datasource i dashboard automatski se učitavaju pri pokretanju, bez ručne konfiguracije. Dashboard sadrži 5 panela:

- HTTP request rate po servisu (prikazuje aktivnost svakog servisa u realnom vremenu)
- Latency percentili p50, p95 i p99 (pokazuje koliko dugo traje obrada zahteva)
- Error rate za 4xx i 5xx odgovore
- Broj aktivnih konekcija
- Trenutni request rate (gauge prikaz)

Grafana je dostupna na `http://localhost:3100` (kredencijali: admin/admin), a Prometheus na `http://localhost:9090`.

---

## 13. Zaključak

Implementiran je kompletan sistem za rezervaciju prostorija u coworking prostoru kao mikroservisna aplikacija. Projekat obuhvata razvoj 5 NestJS servisa sa različitim tipovima međusobne komunikacije (REST, RabbitMQ, SSE), 74 automatska testa, Docker kontejnerizaciju, CI/CD pipeline putem GitHub Actions, statičku analizu koda i monitoring sa Prometheus i Grafana.

Sve faze projekta su završene, testovi prolaze i aplikacija se uspešno pokreće lokalno.

---

*Student: Andjela Lukić, IT62/2022*
*Predmet: Integracije (IROIT), FTN Novi Sad*
