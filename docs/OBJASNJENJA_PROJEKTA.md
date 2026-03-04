# OBJASNJENJA PROJEKTA - Vodic za razumevanje koda
**NAPOMENA: Ovaj fajl se NE pushuje na git. Sluzi samo za tvoje razumevanje.**

---

## Datum: 2026-02-18

---

## 1. STRUKTURA PROJEKTA - Gde se sta nalazi

```
coworking-booking-system/          <-- ROOT FOLDER (ovo je git repo)
│
├── api-gateway/                   <-- ULAZNA TACKA za sve zahteve (port 3000)
│   └── src/
│       ├── main.ts               <-- Startuje servis na portu 3000
│       ├── app.module.ts         <-- Glavni modul - registruje JWT i config
│       ├── app.controller.ts     <-- SRCE GATEWAY-a: prima zahteve i prosledjuje ih
│       └── auth/
│           ├── jwt.strategy.ts   <-- Kako se JWT token citaj/dekodira
│           └── jwt-auth.guard.ts <-- "Cuvar" koji blokira neautorizovane zahteve
│
├── user-service/                  <-- SERVIS ZA KORISNIKE (port 3001)
│   └── src/
│       ├── main.ts               <-- Startuje servis na portu 3001
│       ├── app.module.ts         <-- Glavni modul - povezuje bazu i Users modul
│       ├── users/
│       │   ├── user.entity.ts    <-- MODEL korisnika - kako izgleda u bazi
│       │   ├── users.service.ts  <-- BIZNIS LOGIKA - register, login, pretraga
│       │   ├── users.controller.ts <-- ENDPOINTI - HTTP rute koje klijent poziva
│       │   ├── users.module.ts   <-- Povezuje sve delove Users modula
│       │   └── dto/
│       │       ├── register.dto.ts <-- Pravila za registraciju (sta je obavezno)
│       │       └── login.dto.ts    <-- Pravila za login (sta je obavezno)
│       └── auth/
│           ├── jwt.strategy.ts   <-- JWT dekodiranje
│           └── jwt-auth.guard.ts <-- Zastita ruta
│
├── room-service/                  <-- SERVIS ZA PROSTORIJE (port 3002)
│   └── src/
│       ├── main.ts               <-- Startuje servis na portu 3002
│       ├── app.module.ts         <-- Glavni modul
│       └── rooms/
│           ├── room.entity.ts    <-- MODEL prostorije - kako izgleda u bazi
│           ├── rooms.service.ts  <-- BIZNIS LOGIKA + SEED (automatski unos 8 soba)
│           ├── rooms.controller.ts <-- ENDPOINTI + SSE stream
│           └── rooms.module.ts   <-- Povezuje delove
│
├── booking-service/               <-- SERVIS ZA REZERVACIJE (port 3003)
│   └── src/
│       ├── main.ts               <-- Startuje servis na portu 3003
│       ├── app.module.ts         <-- Glavni modul
│       └── bookings/
│           ├── booking.entity.ts <-- MODEL rezervacije - kako izgleda u bazi
│           ├── bookings.service.ts <-- BIZNIS LOGIKA (najslozeniji fajl!)
│           ├── bookings.controller.ts <-- ENDPOINTI
│           ├── bookings.module.ts <-- Povezuje + RabbitMQ konekcija
│           └── dto/
│               └── create-booking.dto.ts <-- Pravila za kreiranje rezervacije
│
├── notification-service/          <-- SERVIS ZA OBAVESTENJA (port 3004)
│   └── src/
│       ├── main.ts               <-- POSEBAN: startuje I HTTP I RabbitMQ consumer
│       ├── app.module.ts         <-- Glavni modul
│       └── notifications/
│           ├── notification.entity.ts <-- MODEL obavestenja
│           ├── notifications.service.ts <-- Kreiranje obavestenja iz event-a
│           ├── notifications.controller.ts <-- PRIMA RabbitMQ evente + REST citanje
│           └── notifications.module.ts
│
├── .github/workflows/             <-- CI/CD pipeline-i (bice u Fazi 4)
├── prometheus/                    <-- Monitoring config (bice u Fazi 7)
├── grafana/                       <-- Dashboard-i (bice u Fazi 7)
├── .gitignore                     <-- Fajlovi koje git ignorise
└── README.md                      <-- Opis projekta
```

---

## 2. STA JE "ENTITY" (model baze)?

Entity je TypeScript klasa koja opisuje kako tabela u bazi podataka izgleda.
Koristi se biblioteka **TypeORM** koja automatski kreira tabele u PostgreSQL bazi.

### Primer: `user.entity.ts`
```typescript
@Entity('users')          // Ovo znaci: napravi tabelu sa imenom 'users'
export class User {
  @PrimaryGeneratedColumn('uuid')  // Automatski generise jedinstveni ID
  id: string;

  @Column()               // Obicna kolona u tabeli
  name: string;

  @Column({ unique: true })  // Email mora biti jedinstven - ne moze 2 ista
  email: string;

  @Column()
  password: string;        // Cuva se HASHOVAN (bcrypt), ne plaintext!

  @Column({ default: 'member' })  // Ako se ne unese, default je 'member'
  role: string;

  @CreateDateColumn()      // Automatski stavlja datum kreiranja
  createdAt: Date;
}
```

**Rezultat:** Kada se servis pokrene, TypeORM automatski kreira tabelu `users` sa kolonama: id, name, email, password, role, createdAt, updatedAt.

### Sve tabele u bazi:
| Tabela | Servis | Kolone |
|---|---|---|
| `users` | User Service | id, name, email, password, role, createdAt, updatedAt |
| `rooms` | Room Service | id, name, type, capacity, amenities, isActive, createdAt |
| `bookings` | Booking Service | id, userId, roomId, date, startTime, endTime, status, createdAt |
| `notifications` | Notification Service | id, userId, type, message, isRead, createdAt |

---

## 3. STA JE "DTO" (Data Transfer Object)?

DTO definise PRAVILA za podatke koji dolaze od korisnika. Ako korisnik posalje pogresan podatak, servis odmah vraca gresku.

### Primer: `register.dto.ts`
```typescript
export class RegisterDto {
  @IsString()         // Mora biti string (tekst)
  @IsNotEmpty()       // Ne sme biti prazno
  name: string;

  @IsEmail()          // Mora biti validan email format
  email: string;

  @IsString()
  @MinLength(6)       // Lozinka mora imati minimum 6 karaktera
  password: string;
}
```

**Sta se desi ako korisnik posalje los podatak?**
- Posalje `email: "nije-email"` -> Greska: "email must be an email"
- Posalje `password: "123"` -> Greska: "password must be longer than or equal to 6 characters"
- Ne posalje `name` -> Greska: "name should not be empty"

---

## 4. STA JE "SERVICE" (servis/biznis logika)?

Service sadrzi svu logiku aplikacije. Controller samo prima HTTP zahtev i prosledjuje ga service-u.

### Primer: `users.service.ts` - Registracija
```typescript
async register(registerDto: RegisterDto) {
  // 1. Proveri da li email vec postoji u bazi
  const existing = await this.usersRepository.findOne({
    where: { email: registerDto.email }
  });
  if (existing) {
    throw new ConflictException('Email is already registered');
    // -> Vraca HTTP 409 Conflict gresku
  }

  // 2. Hashuj lozinku (nikad ne cuvamo plain text!)
  const hashedPassword = await bcrypt.hash(registerDto.password, 10);
  // "10" je salt rounds - koliko puta se hashuje (vise = sigurnije ali sporije)

  // 3. Kreiraj korisnika u bazi
  const user = this.usersRepository.create({
    ...registerDto,
    password: hashedPassword,
  });
  const saved = await this.usersRepository.save(user);

  // 4. Vrati podatke BEZ lozinke (nikad ne saljemo hash nazad!)
  const { password, ...result } = saved;
  return result;
}
```

---

## 5. STA JE "CONTROLLER" (kontroler)?

Controller definise HTTP rute (endpointe) - to je ono sto korisnik poziva.

### Primer: `users.controller.ts`
```
POST /users/register  -> Poziva usersService.register()
POST /users/login     -> Poziva usersService.validateUser() + kreira JWT token
GET  /users/profile   -> ZASTICENO (treba JWT) - vraca profil ulogovanog korisnika
GET  /users/:id       -> Vraca podatke korisnika po ID-u
```

---

## 6. STA JE JWT (JSON Web Token)?

JWT je nacin autentifikacije. Umesto da server cuva sesiju, korisnik dobija TOKEN koji sadrzi njegove podatke.

### Kako radi:
1. Korisnik se uloguje: `POST /users/login` sa email + password
2. Server proveri podatke i ako su ispravni, kreira JWT token:
   ```json
   {
     "sub": "user-uuid-123",      // ID korisnika
     "email": "andjela@test.com",
     "role": "member",
     "exp": 1708387200            // Istice za 24h
   }
   ```
3. Korisnik cuva token i salje ga sa svakim zahtevom u header-u:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```
4. Server dekodira token (jwt.strategy.ts) i zna ko je korisnik

### Gde se koristi:
- `jwt.strategy.ts` - Dekodira token i izvlaci podatke (id, email, role)
- `jwt-auth.guard.ts` - "Cuvar" koji se stavlja na rute: ako nemas validan token, dobijes 401 Unauthorized
- `@UseGuards(JwtAuthGuard)` - Dekorator koji stiti rutu

---

## 7. KAKO RADI API GATEWAY?

API Gateway je JEDINA ulazna tacka za klijente. Klijent nikad ne komunicira direktno sa servisima.

```
Klijent --> API Gateway (port 3000) --> User Service (port 3001)
                                    --> Room Service (port 3002)
                                    --> Booking Service (port 3003)
                                    --> Notification Service (port 3004)
```

### Sta radi:
1. **Prima zahtev** od klijenta (npr. `POST /api/bookings`)
2. **Proverava JWT** - ako je ruta zasticena, dekodira token
3. **Prosledjuje zahtev** odgovarajucem servisu (bookings -> port 3003)
4. **Dodaje x-user-id header** - tako interni servisi znaju ko je korisnik
5. **Vraca odgovor** klijentu

### Javne rute (ne treba JWT):
- `POST /api/users/register` - registracija
- `POST /api/users/login` - login
- `GET /api/rooms` - lista prostorija
- `GET /api/rooms/:id` - detalji prostorije

### Zasticene rute (treba JWT):
- `GET /api/users/profile` - moj profil
- `POST /api/bookings` - nova rezervacija
- `GET /api/bookings` - moje rezervacije
- `DELETE /api/bookings/:id` - otkazi rezervaciju
- `GET /api/notifications` - moja obavestenja

---

## 8. KAKO RADI BOOKING SERVICE - Biznis logika

Ovo je NAJSLOZENIJI servis. Kada korisnik pravi rezervaciju, desava se:

### Korak po korak:
1. **Validacija vremena:**
   - Da li je endTime posle startTime?
   - Da li je trajanje minimum 30 minuta?
   - Da li su vremena u koracima od 30 min? (09:00, 09:30, 10:00 - OK; 09:15 - GRESKA)

2. **Provera max rezervacija:**
   - Korisnik moze imati max 3 aktivne rezervacije istog dana
   - Ako vec ima 3, dobija gresku

3. **Provera dostupnosti prostorije:**
   - Gleda u bazu da li neko vec ima rezervaciju u toj prostoriji u to vreme
   - Koristi SQL upit: "gde se startTime < moj endTime I endTime > moj startTime"
   - Ovo detektuje SVE vrste preklapanja

4. **Provera preklapanja korisnika:**
   - Ista provera ali za korisnika - ne mozes biti na 2 mesta istovremeno

5. **Kreiranje rezervacije** u bazi

6. **Slanje RabbitMQ event-a:**
   - Emituje `booking_created` event sa podacima o rezervaciji
   - Notification Service prima ovaj event i kreira obavestenje

---

## 9. KAKO RADI RABBITMQ KOMUNIKACIJA?

RabbitMQ je MESSAGE BROKER - posrednik za poruke izmedju servisa.

```
Booking Service --[booking_created]--> RabbitMQ Queue --> Notification Service
Booking Service --[booking_cancelled]--> RabbitMQ Queue --> Notification Service
```

### Zasto RabbitMQ a ne direktan HTTP poziv?
- **Decoupling:** Booking Service ne mora da zna da Notification Service postoji
- **Pouzdanost:** Ako Notification padne, poruka ostaje u redu i bice obradjena kad se vrati
- **Asinhrono:** Booking ne ceka da se obavestenje posalje - odmah vraca odgovor korisniku

### Gde se konfigurisce:
- **Booking Service** (`bookings.module.ts`): `ClientsModule` - registruje RabbitMQ klijenta
- **Booking Service** (`bookings.service.ts`): `this.notificationsClient.emit(...)` - salje event
- **Notification Service** (`main.ts`): `app.connectMicroservice(...)` - slusa RabbitMQ queue
- **Notification Service** (`notifications.controller.ts`): `@EventPattern('booking_created')` - prima event

---

## 10. STA JE SSE (Server-Sent Events)?

SSE je REAKTIVNA KOMUNIKACIJA - server salje podatke klijentu u realnom vremenu, bez da klijent pita.

### Kako radi:
1. Klijent otvori konekciju: `GET /rooms/availability/stream`
2. Konekcija ostaje OTVORENA
3. Kada se nesto promeni (nova rezervacija, otkazivanje), server automatski posalje podatak
4. Klijent prima update bez da je morao da pita ponovo

### Gde u kodu:
- `rooms.service.ts`: `Subject` iz RxJS biblioteke - emituje promene
- `rooms.controller.ts`: `@Sse()` dekorator - otvara SSE stream

### Zasto SSE a ne WebSocket?
- Jednostavniji za implementaciju
- Dovoljan za jednosmerni stream (server -> klijent)
- Zahtev iz specifikacije: "reaktivna komunikacija"

---

## 11. KAKO RADI MODULE SISTEM U NESTJS?

NestJS koristi MODULE pattern za organizaciju koda. Svaki deo aplikacije je modul.

```
AppModule (glavni)
  └── UsersModule
        ├── UsersController (HTTP rute)
        ├── UsersService (biznis logika)
        └── User Entity (model baze)
```

### `app.module.ts` - Glavni modul svakog servisa:
- `ConfigModule.forRoot()` - Ucitava environment varijable (.env fajl)
- `TypeOrmModule.forRootAsync()` - Konekcija na PostgreSQL bazu
- Import specificnog modula (UsersModule, RoomsModule, itd.)

### Zasto moduli?
- **Organizacija** - svaki feature u svom modulu
- **Enkapsulacija** - modul kontrolise sta izvozi (exports)
- **Testabilnost** - mozes testirati svaki modul nezavisno

---

## 12. ENVIRONMENT VARIJABLE

Umesto da hardkodiramo vrednosti (npr. sifru baze), koristimo environment varijable:

```
DB_HOST=localhost          # Adresa baze
DB_PORT=5432              # Port baze
DB_USERNAME=postgres      # Username za bazu
DB_PASSWORD=postgres      # Sifra za bazu
DB_NAME=coworking         # Ime baze
JWT_SECRET=coworking-secret-key  # Tajni kljuc za JWT tokene
RABBITMQ_URL=amqp://guest:guest@localhost:5672  # RabbitMQ adresa
```

### Zasto env varijable?
- **Sigurnost** - sifre ne idu u kod/git
- **Fleksibilnost** - razlicite vrednosti za development/production
- **Docker** - lako se menjaju u docker-compose.yml

---

## REZIME: Sta je do sada uradjeno i zasto

| Sta | Zasto | Gde |
|---|---|---|
| 5 NestJS projekata | Mikroservisna arhitektura (zahtev specifikacije) | Svaki u svom folderu |
| User Entity + Service + Controller | Registracija i login korisnika | `user-service/src/users/` |
| JWT autentifikacija | Zastita ruta, znamo ko je korisnik | `*/auth/jwt.strategy.ts` |
| Room Entity + Seed | 2 meeting room + 6 booth automatski u bazi | `room-service/src/rooms/` |
| SSE stream | Reaktivna komunikacija (zahtev specifikacije) | `rooms.controller.ts` |
| Booking Service sa validacijom | Rezervacije sa svim pravilima | `booking-service/src/bookings/` |
| RabbitMQ integracija | Message Queue komunikacija (zahtev specifikacije) | Booking -> Notification |
| Notification consumer | Prima evente i cuva obavestenja | `notification-service/src/notifications/` |
| API Gateway proxy | Jedan ulaz za sve, JWT zastita | `api-gateway/src/` |
| .gitignore | Ne pushujemo node_modules, .env | Root folder |
| README.md | Dokumentacija projekta | Root folder |

---

## Datum: 2026-02-19

---

## 13. UNIT TESTOVI - Sta su i kako rade

### Sta je unit test?
Unit test testira **jednu funkciju ili metodu** u izolaciji, bez prave baze podataka, bez servera, bez RabbitMQ-a. Koristimo **mock-ove** (lazne objekte) koji simuliraju ponasanje baze.

### Kako to radi u NestJS-u?
```typescript
// 1. Kreiramo "lazni" repozitorijum
const mockRepository = {
  findOne: jest.fn(),   // jest.fn() = funkcija koju MI kontrolisemo
  save: jest.fn(),
};

// 2. Kazemo NestJS-u: "koristi mock umesto prave baze"
const module = await Test.createTestingModule({
  providers: [
    UsersService,                              // Pravi servis
    { provide: getRepositoryToken(User), useValue: mockRepository }, // Mock baza
  ],
}).compile();

// 3. Pre svakog testa resetujemo mock-ove
jest.clearAllMocks();

// 4. U testu zadajemo sta mock vraca
mockRepository.findOne.mockResolvedValue({ id: '1', name: 'Test' });

// 5. Pozovemo pravu metodu servisa
const result = await service.findById('1');

// 6. Proverimo rezultat
expect(result.name).toBe('Test');
```

### Zasto mock-ovi a ne prava baza?
- **Brzina** - testovi traju milisekunde, ne trebaju PostgreSQL server
- **Izolacija** - testiramo SAMO logiku servisa, ne bazu
- **Pouzdanost** - test nece pasti zato sto baza nije dostupna
- **Kontrola** - MI odlucujemo sta "baza vraca" (uspeh, null, gresku)

### Sta smo testirali u svakom servisu?

**User Service (7 testova):**
| Test | Sta proverava | Ocekivani rezultat |
|---|---|---|
| register - uspesno | Novi korisnik sa validnim podacima | Vraca korisnika BEZ lozinke |
| register - duplikat | Email koji vec postoji | Baca ConflictException |
| validateUser - ispravno | Tacan email + tacna lozinka | Vraca korisnika |
| validateUser - pogresna lozinka | Tacan email + pogresna lozinka | Vraca null |
| validateUser - ne postoji | Email koji nije u bazi | Vraca null |
| findById - pronadjen | ID koji postoji | Vraca korisnika BEZ lozinke |
| findById - ne postoji | ID koji ne postoji | Baca UnauthorizedException |

**Booking Service (14 testova) - NAJVAZNIJI:**
| Test | Sta proverava | Ocekivani rezultat |
|---|---|---|
| create - validno | Soba slobodna, korisnik ima < 3 rez | Kreira + salje RabbitMQ event |
| create - endTime < startTime | 10:00-09:00 | BadRequestException |
| create - < 30 min | 09:00-09:15 | BadRequestException |
| create - los interval | 09:15-10:00 | BadRequestException (mora 30-min korak) |
| create - 3 rez/dan | Korisnik vec ima 3 | ConflictException |
| create - soba zauzeta | Preklapanje sa drugom rez za istu sobu | ConflictException |
| create - korisnik zauzet | Korisnik ima rez u isto vreme | ConflictException |
| create - 2h rez | 09:00-11:00 | Uspesno (duze rezervacije su dozvoljene) |
| cancel - uspesno | Vlasnik otkazuje | status='cancelled' + RabbitMQ event |
| cancel - tudja rez | Drugi korisnik pokusava | BadRequestException |
| cancel - vec otkazana | Status vec 'cancelled' | BadRequestException |
| cancel - ne postoji | Nepostojeci ID | NotFoundException |
| findByUser | Sve rez za korisnika | Lista rezervacija |
| findByRoom | Rez za sobu na datum | Lista aktivnih rez |

**Room Service (8 testova):**
| Test | Sta proverava | Ocekivani rezultat |
|---|---|---|
| findAll | Aktivne prostorije | Lista sa isActive=true |
| findById - pronadjen | Prostorija po ID-u | Vraca prostoriju sa detaljima |
| findById - ne postoji | Nepostojeci ID | NotFoundException |
| findByType - meeting | Samo meeting_room tip | Vraca 2 meeting room-a |
| findByType - booth | Samo phone_booth tip | Vraca phone booth-ove |
| seed - prazna tabela | count=0, tabela prazna | Kreira 8 prostorija (2+6) |
| seed - vec postoje | count=8 | Ne kreira nista (preskace) |
| SSE stream | Emitovanje availability dogadjaja | Observable prima event |

**Notification Service (6 testova):**
| Test | Sta proverava | Ocekivani rezultat |
|---|---|---|
| create | Kreiranje notifikacije | Vraca notifikaciju sa isRead=false |
| findByUser | Notifikacije za korisnika | Sortirano po createdAt DESC |
| markAsRead - uspesno | Oznacavanje kao procitano | isRead=true |
| markAsRead - ne postoji | Nepostojeci ID | NotFoundException |
| handleBookingCreated | booking_created event | Poruka sadrzi "confirmed" + vreme |
| handleBookingCancelled | booking_cancelled event | Poruka sadrzi "cancelled" |

**API Gateway (1 test):**
| Test | Sta proverava | Ocekivani rezultat |
|---|---|---|
| health | Health endpoint | status='ok', lista 4 servisa |

### Kako pokrenuti testove?
```bash
# Svi testovi u jednom servisu:
cd booking-service && npx jest

# Svi testovi u svim servisima (pokreni iz svakog foldera):
cd user-service && npx jest
cd room-service && npx jest
cd notification-service && npx jest
cd api-gateway && npx jest
```

### Pregled - 36 testova ukupno:
| Servis | Broj testova | Fajl |
|---|---|---|
| User Service | 7 | `users.service.spec.ts` |
| Booking Service | 14 | `bookings.service.spec.ts` |
| Room Service | 8 | `rooms.service.spec.ts` |
| Notification Service | 6 | `notifications.service.spec.ts` |
| API Gateway | 1 | `app.controller.spec.ts` |
| **UKUPNO** | **36** | |

---

## Datum: 2026-02-19 (nastavak)

---

## 14. DOCKER - Kontejnerizacija aplikacije

### Sta je Docker?
Docker pakuje aplikaciju i sve njene zavisnosti u **kontejner** - izolovano okruzenje koje radi isto na svakom racunaru. Umesto "radi na mom racunaru, ne radi na tvom", Docker garantuje da ce raditi svuda isto.

### Sta je Dockerfile?
Dockerfile je **recept** koji objasnjava Docker-u kako da napravi sliku (image) naseg servisa. Mi koristimo **multi-stage build** koji ima 2 faze:

```dockerfile
# FAZA 1: BUILDER - kompajlira TypeScript u JavaScript
FROM node:22-alpine AS builder    # Bazna slika: Node.js 22 na Alpine Linux-u
WORKDIR /app                      # Radni folder unutar kontejnera
COPY package.json ./              # Prvo kopiramo samo package.json (za kesh)
RUN npm install                   # Instaliramo SVE zavisnosti (i dev)
COPY . .                          # Kopiramo ceo izvorni kod
RUN npm run build                 # Kompajliramo TypeScript -> JavaScript (u dist/ folder)

# FAZA 2: PRODUCTION - samo ono sto treba za rad
FROM node:22-alpine AS production # Nova, cista slika
WORKDIR /app
COPY package.json ./
RUN npm install --only=production # Instaliramo SAMO produkcione zavisnosti (bez dev)
COPY --from=builder /app/dist ./dist  # Kopiramo kompajlirani kod iz faze 1
EXPOSE 3001                       # Dokumentujemo koji port servis koristi
CMD ["node", "dist/main.js"]      # Komanda za pokretanje servisa
```

### Zasto multi-stage build?
- **Manja slika** - produkciona slika nema TypeScript, jest, eslint, itd.
- **Sigurnost** - manje zavisnosti = manja povrsina za napade
- **Brzina** - manja slika se brze preuzima i pokrece

### Sta je .dockerignore?
Isto kao `.gitignore`, ali za Docker. Kaze Docker-u sta da NE kopira u kontejner:
```
node_modules    # Ne kopiramo jer ih Docker sam instalira
dist            # Ne kopiramo jer ih Docker sam kompajlira
.git            # Ne treba git istorija u kontejneru
```

### Sta je docker-compose.yml?
Docker Compose je alat koji pokrece **vise kontejnera odjednom**. Umesto da rucno pokrecemo 9 servisa, napisemo jedan fajl:

```yaml
services:
  postgres:           # Baza podataka
    image: postgres:16-alpine
    ports: ["5432:5432"]
    healthcheck:      # Proverava da li je baza spremna
      test: pg_isready -U coworking

  rabbitmq:           # Message broker
    image: rabbitmq:3-management-alpine
    ports: ["5672:5672", "15672:15672"]  # 15672 = web UI

  user-service:       # Nas servis
    build: ./user-service    # Koristi Dockerfile iz tog foldera
    depends_on:
      postgres:
        condition: service_healthy  # Ceka da baza bude spremna!
```

### Kljucni koncepti u docker-compose.yml:
| Koncept | Objasnjenje |
|---|---|
| `build: ./folder` | Pravi Docker sliku koristeci Dockerfile iz tog foldera |
| `image: postgres:16` | Koristi gotovu sliku sa Docker Hub-a |
| `ports: ["5432:5432"]` | Mapira port iz kontejnera na host (tvoj racunar) |
| `depends_on + condition` | Servis ceka da zavisnost bude zdrava pre startovanja |
| `healthcheck` | Periodicno proverava da li servis radi (pg_isready, rabbitmq-diagnostics) |
| `networks` | Svi servisi su na istoj mrezi i mogu da komuniciraju po imenu |
| `volumes` | Trajno skladiste - podaci ostaju i kad se kontejner restartuje |

### Kako pokrenuti ceo sistem?
```bash
# Pokreni sve (prvi put ce trajati duze jer pravi slike)
docker compose up --build -d

# Proveri status kontejnera
docker compose ps

# Zaustavi sve
docker compose down

# Zaustavi sve i obrisi podatke (volumes)
docker compose down -v
```

### Nasih 9 kontejnera:
| Kontejner | Slika | Port |
|---|---|---|
| coworking-postgres | postgres:16-alpine | 5432 |
| coworking-rabbitmq | rabbitmq:3-management-alpine | 5672, 15672 |
| coworking-user-service | Nas Dockerfile | 3001 |
| coworking-room-service | Nas Dockerfile | 3002 |
| coworking-booking-service | Nas Dockerfile | 3003 |
| coworking-notification-service | Nas Dockerfile | 3004 |
| coworking-api-gateway | Nas Dockerfile | 3000 |
| coworking-prometheus | prom/prometheus | 9090 |
| coworking-grafana | grafana/grafana | 3100 |

---

## 15. CI PIPELINE - Kontinuirana Integracija (GitHub Actions)

### Sta je CI (Continuous Integration)?
CI je praksa gde se kod **automatski testira i kompajlira** svaki put kad neko pushuje na git. Cilj: uhvatiti greske sto pre, pre nego sto dodju u produkciju.

### Sta je GitHub Actions?
GitHub Actions je CI/CD platforma koja pokrece **workflow-e** (automatizovane korake) direktno na GitHub-u. Workflow se definise u YAML fajlu.

### Nas CI pipeline (`.github/workflows/ci.yml`):

```
PUSH ili PR → GitHub Actions pokrece pipeline:

JOB 1: build-and-test (5 servisa PARALELNO)
  ┌─────────────────┐
  │ 1. Checkout koda │  ← Preuzima kod iz repo-a
  │ 2. Setup Node 22 │  ← Instalira Node.js
  │ 3. Cache modules │  ← Koristi kesirane pakete (brze!)
  │ 4. npm install   │  ← Instalira zavisnosti
  │ 5. ESLint lint   │  ← Staticka analiza koda
  │ 6. npm run build │  ← Kompajlira TypeScript
  │ 7. npx jest      │  ← Pokrece unit testove
  └────────┬────────┘
           │ Svih 5 mora da prodje
           ▼
JOB 2: docker-build (5 servisa PARALELNO)
  ┌──────────────────────┐
  │ docker build za svaki │  ← Proverava da se Docker slika pravi
  └──────────────────────┘
```

### Sta je Matrix strategija?
Umesto da pisemo isti posao 5 puta (za svaki servis), koristimo **matrix**:
```yaml
strategy:
  matrix:
    service:
      - api-gateway
      - user-service
      - room-service
      - booking-service
      - notification-service
```
GitHub automatski pokrece **5 paralelnih instanci**, svaku za jedan servis. To je kao da imamo 5 racunara koji istovremeno testiraju.

### Sta je Cache?
```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ${{ matrix.service }}/node_modules
    key: ${{ runner.os }}-${{ matrix.service }}-${{ hashFiles('package.json') }}
```
Cache cuva `node_modules` folder izmedju pokretanja. Ako se `package.json` nije promenio, ne mora ponovo da preuzima 200MB paketa - koristi kesiranu verziju. Ubrzava pipeline sa ~3min na ~1min.

### Sta se desi kad pipeline padne?
- Na GitHub-u se pojavi **crveni X** pored commit-a
- Pull Request se ne moze merge-ovati (zastitna pravila)
- Razvojni tim odmah vidi sta je pokvareno

### Sta znaci zeleni checkmark?
- Svih 36 testova prolazi
- ESLint ne nalazi greske
- Kod se uspesno kompajlira
- Docker slike se uspesno prave
- **Kod je bezbedan za merge!**

---

## 16. STATICKA ANALIZA KODA - ESLint

### Sta je staticka analiza?
Staticka analiza proverava kod **bez pokretanja** - trazi potencijalne greske, losim praksama, nekonzistentan stil. Kao "spell check" za programere.

### Sta je ESLint?
ESLint je najpopularniji alat za staticku analizu JavaScript/TypeScript koda. Proverava:
- **Greske** - neiskoristene varijable, nedostajuci return
- **Stil** - formatiranje, navodnici, razmaci
- **Best practices** - opasne operacije, potencijalni bugovi

### Nasa ESLint konfiguracija (`eslint.config.mjs`):
```javascript
// ESLint v9 koristi "flat config" - novi format konfiguracije
export default tseslint.config(
  eslint.configs.recommended,          // Osnovna pravila
  ...tseslint.configs.recommendedTypeChecked,  // TypeScript pravila
  eslintPluginPrettierRecommended,     // Prettier formatiranje
  {
    rules: {
      // ISKLJUCENA pravila (potrebna za nas proxy pattern):
      '@typescript-eslint/no-unsafe-assignment': 'off',  // Gateway koristi 'any'
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // PRILAGODJENA pravila:
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',        // Dozvoli _password, _req itd.
        ignoreRestSiblings: true         // Dozvoli const { password, ...rest } = obj
      }],

      // Prettier - automatsko formatiranje koda
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
```

### Zasto smo iskljucili neka pravila?
API Gateway radi kao **proxy** - prima zahtev i prosledjuje ga drugom servisu. Posto ne zna unapred kakav ce odgovor biti, koristi `any` tip. TypeScript pravila koja zabranjuju `any` bi blokirala ceo Gateway, zato su iskljucena samo ta pravila.

### Sta je Prettier?
Prettier je alat za **automatsko formatiranje koda** - stavlja razmake, navodnice, nove redove na konzistentan nacin. Integrisali smo ga sa ESLint-om tako da ESLint prijavi formatiranje kao gresku.

### Kako pokrenuti ESLint?
```bash
# Proveri kod (prijavi greske)
npx eslint src/

# Proveri i automatski popravi sto moze
npx eslint src/ --fix
```

---

## 17. CD PIPELINE - Kontinuirana Isporuka

### Sta je CD (Continuous Delivery)?
CD je nastavak CI-ja. Dok CI testira kod, CD ga **automatski priprema za deploy** (isporuku). U nasem slucaju, CD se pokrece kada se kod merge-uje u `main` granu.

### Razlika CI vs CD:
| | CI | CD |
|---|---|---|
| **Kada** | Na svaki push/PR | Na merge u main |
| **Cilj** | Proveri da kod radi | Pripremi za deploy |
| **Fajl** | ci.yml | cd.yml |
| **Rezultat** | "Kod je ispravan" | "Aplikacija je spremna za produkciju" |

### Nas CD pipeline (`.github/workflows/cd.yml`):
```
MERGE u main → CD pipeline se pokrece:

JOB 1: Pre-deploy testovi
  → Ponovo pokrece sve testove (za sigurnost)

JOB 2: Build Docker Images
  → Pravi Docker slike sa dva taga:
    - latest (uvek poslednja verzija)
    - abc123 (SHA commit hash - tacna verzija)

JOB 3: Verify Docker Compose
  → docker compose config  (provera sintakse)
  → docker compose build   (pravljenje slika)
  → docker compose up -d   (pokretanje svih servisa)
  → sleep 30               (cekanje da se podignu)
  → curl /health           (health check)
  → docker compose down -v (ciscenje)
```

### Sta su Docker tagovi?
Tag je oznaka verzije Docker slike:
```bash
coworking-user-service:latest    # Uvek poslednja verzija
coworking-user-service:a1b2c3d   # Tacna verzija (SHA hash commit-a)
```
`latest` je zgodan za razvoj, ali SHA tag je bitan za produkciju - uvek znas TACNO koja verzija koda je deploy-ovana.

---

## 18. MONITORING - Prometheus + Grafana

### Sta je monitoring?
Monitoring je **pracenje rada aplikacije u realnom vremenu**. Odgovara na pitanja:
- Koliko zahteva servis prima po sekundi?
- Koliko traje obrada zahteva?
- Koliko memorije koristi?
- Da li ima gresaka (4xx, 5xx)?

### Komponente monitoring sistema:

```
NestJS servisi (5 kom)
    │
    │ GET /metrics (svakih 15s)
    ▼
Prometheus (port 9090)         ← Prikuplja i cuva metrike
    │
    │ PromQL upiti
    ▼
Grafana (port 3100)            ← Vizualizuje metrike u dashboard-ima
```

### 1. prom-client (u svakom servisu)
`prom-client` je Node.js biblioteka koja automatski prikuplja metrike o radu servisa:

```typescript
import { collectDefaultMetrics, register } from 'prom-client';

// Automatski prikuplja: CPU, memorija, event loop, GC, HTTP zahtevi
collectDefaultMetrics();

@Controller()
export class MetricsController {
  @Get('metrics')
  async getMetrics(@Res() res: any) {
    // Vraca metrike u Prometheus formatu (plain text)
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
```

Kada otvoris `http://servis:port/metrics`, vidis nesto ovako:
```
# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.
process_cpu_user_seconds_total 0.234
# HELP nodejs_active_handles Number of active libuv handles.
nodejs_active_handles{type="WriteStream"} 2
```

### 2. Prometheus (prikupljac metrika)
Prometheus je server koji svakih 15 sekundi poziva `/metrics` endpoint svakog servisa i **cuva podatke** u vremensku bazu (time series database).

Konfiguracija (`prometheus/prometheus.yml`):
```yaml
global:
  scrape_interval: 15s    # Koliko cesto prikuplja metrike

scrape_configs:
  - job_name: "api-gateway"
    metrics_path: /metrics
    static_configs:
      - targets: ["api-gateway:3000"]  # Adresa servisa u Docker mrezi
  - job_name: "user-service"
    static_configs:
      - targets: ["user-service:3001"]
  # ... isto za ostale servise
```

### 3. Grafana (vizualizacija)
Grafana je web aplikacija za kreiranje **dashboard-a** sa grafovima i metrikama.

**Pristup:** `http://localhost:3100` (login: admin/admin)

Nas dashboard ima 5 panela:
| Panel | Sta prikazuje | Tip grafika |
|---|---|---|
| HTTP Request Rate | Broj zahteva po sekundi za svaki servis | Linijski grafikon |
| Latency Percentiles | Vreme odgovora (p50, p95, p99) | Linijski grafikon |
| Error Rate | Broj 4xx i 5xx gresaka | Barchart |
| Active Connections | Trenutne aktivne konekcije | Linijski grafikon |
| Current Request Rate | Trenutna brzina zahteva | Gauge (brzinomer) |

### Grafana provisioning (automatska konfiguracija):
Umesto da rucno podesavamo Grafana-u, koristimo **provisioning** - fajlove koji automatski konfigurisu:
- `grafana/provisioning/datasources/datasource.yml` - povezuje Grafanu sa Prometheus-om
- `grafana/provisioning/dashboards/dashboard.yml` - govori Grafani gde su dashboard JSON fajlovi
- `grafana/dashboards/coworking-overview.json` - sam dashboard sa 5 panela

### Zasto monitoring?
- **Zahtev specifikacije** - monitoring je jedna od 10 obaveznih stavki
- **DevOps praksa** - u produkciji je kriticno znati sta se desava sa aplikacijom
- **Dijagnostika** - kada nesto ne radi, metrike pomazu da se brzo nadje uzrok

---

## REZIME SVIH FAZA:

| Faza | Sta | Alati | Fajlovi |
|---|---|---|---|
| 0 | Inicijalizacija | NestJS CLI, Git, GitHub | package.json, .gitignore, README.md |
| 1 | Mikroservisi | NestJS, TypeORM, JWT, RabbitMQ | entity, service, controller, dto fajlovi |
| 2 | Testiranje | Jest, Mock repositories | *.spec.ts fajlovi |
| 3 | Docker | Docker, Docker Compose | Dockerfile, .dockerignore, docker-compose.yml |
| 4 | CI | GitHub Actions | .github/workflows/ci.yml |
| 5 | ESLint | ESLint v9, Prettier | eslint.config.mjs |
| 6 | CD | GitHub Actions, Docker | .github/workflows/cd.yml |
| 7 | Monitoring | Prometheus, Grafana, prom-client | metrics.controller.ts, prometheus.yml, dashboard.json |
