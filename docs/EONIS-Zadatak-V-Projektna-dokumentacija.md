# Projektna dokumentacija — veb prodavnica  
### Tema: coworking portal (rezervacije prostora + prodaja paketa/usluga)

**Predmet:** Eksploatacija, održavanje i nadogradnja informacionih sistema — školska godina **2025/26**.  
**Projektni zadatak (tekst predmeta):** *VEB PRODAVNICA* — razvoj veb prodavnice uz samostalan izbor teme i tehnologija uz konsultaciju sa predmetnim asistentima.  
**Student:** Andjela Lukic — IT62/2022  
**Repozitorijum:** `coworking-booking-system`  
**Verzija dokumenta:** 1.1  

---

## Objašnjenje: šta znači „code first” naspram „database first” (Zadatak II)

U **Projektnoj specifikaciji EONIS** za Zadatak II doslovno piše:

> *„Takođe, moguće je izabrati da li se koristi **code first** ili **database first** pristup.  
> Ukoliko se odlučite za **database first** pristup, potrebno je da kreirate bazu podataka koja **mora da sadrži minimum jedan triger** koji odgovara biznis logici sistema.  
> Ukoliko se koristi **code first** pristup, ta biznis logika će biti **realizovana kroz programski kod**.“*

**Šta to znači za tebe:**

| Pristup | Šta uradiš | Trigger u PostgreSQL-u |
|--------|------------|-------------------------|
| **Database first** | Prvo projektuješ bazu (npr. ER dijagram, SQL skripte), aplikacija prati bazu | **Da — obavezan minimum jedan**, vezan za biznis logiku |
| **Code first** | Model i šema nastaju iz entiteta u kodu (npr. TypeORM); pri pokretanju se šema usklađuje ili migrira | **Ne — nije predviđen u specifikaciji**; logika je u servisima |

Specifikacija **ne kaže** koji je pristup „bolji“ — **biraš jedan** i držiš se pravila za njega.

**Ovaj projekat:** primenjuje se **code first** (NestJS + TypeORM sa `synchronize: true` u razvoju). Univerzalni primeri iz specifikacije:

- *„nemogućnost dodavanja u korpu veće količine proizvoda nego što je dostupno na stanju“* — realizovano u `commerce-service` pri kreiranju porudžbine/checkout-a;  
- *„smanjivanje količine proizvoda na stanju nakon poručivanja“* — realizovano pri prelasku porudžbine u stanje plaćeno (Stripe webhook ili demo potvrda).

Stoga **nije nedostatak projekta** što u bazi nema triggera — uz izabrani **code first** pristup to je u skladu sa tekstom specifikacije.

*(Napomena predmeta: *„potrebno je sa asistentom na vežbama proveriti da li je izabrana tehnologija u redu“* — za backend i frontend.)*

---

## Sadržaj (Zadatak V — struktura iz specifikacije)

Projektna dokumentacija po predmetu **mora** da sadrži sledeće poglavlja (numeracija kao u PDF-u):

1. Opis realnog sistema  
2. Korišćene tehnologije  
3. UML dijagrami  
   - a. Dijagram slučajeva upotrebe  
   - b. Dijagram klasa  
4. Baza podataka *(u zavisnosti od code first/database first pristupa objasniti proces)*  
5. Opis predloženog rešenja  
6. Zaključak  

*(U dokumentu ispod, naslovi prate ovu strukturu.)*

---

## 1. Opis realnog sistema

### 1.1 Poslovni kontekst

Realni sistem koji se modeluje jeste **coworking prostor** koji kombinuje:

- **Rezervacije resursa u vremenu** (sale za sastanke, phone booth-ovi) uz pravila trajanja, preklapanja i dnevnog limita aktivnih rezervacija po korisniku;  
- **Veb prodavnicu** u smislu projektne specifikacije — katalog **proizvoda/paketa/usluga**, **korisnik**, uloga **administratora**, **porudžbina**, **stavka porudžbine** (asocijativna struktura), kao i plaćanje putem **testnog Stripe** procesora i prikaz transakcije administratoru.

Granica sistema obuhvata **portal i backend** (API Gateway i mikroservisi). Spoljni akter **Stripe** učestvuje u plaćanju i slanju webhook događaja.

### 1.2 Uloge (Zadatak III / IV)

Specifikacija zahteva **minimum dve uloge**, od kojih je jedna **ADMIN**, a druga **CUSTOMER i/ili USER**.

| Uloga u implementaciji | Odgovara predmetu |
|------------------------|-------------------|
| `admin` | **ADMIN** — administratorski panel (korisnici, rezervacije, proizvodi, transakcije) |
| `member` | **CUSTOMER** / korisnik portala — rezervacije, kupovina, istorija porudžbina |
| gost (bez naloga) | Pristup javnim GET endpoint-ima (katalog, zauzetost) |

Autentifikacija i autorizacija: **JWT** na API Gateway-u; identitet i uloga se prosleđuju mikroservisima zaglavljima (`x-user-id`, `x-user-role`).

---

## 2. Korišćene tehnologije

### 2.1 Backend i podaci

- **Node.js**, **NestJS**, **TypeScript** — REST API po mikroservisima.  
- **PostgreSQL 16**, **TypeORM** — perzistencija; **code first** (videti poglavlje 4).  
- **RabbitMQ** — asinhroni događaji rezervacija → obaveštenja.  
- **Docker / Docker Compose** — pokretanje okruženja.  
- **Prometheus / Grafana**, **GitHub Actions** — monitoring i CI/CD (projekat Integracije / DevOps).

### 2.2 Frontend (citati iz specifikacije — Zadatak IV)

U PDF-u piše:

> *„Izbor tehnologije za ovaj deo projekta je **opcioni za studente** (**Angular, Vue.js ili React**). Neophodno je da se za podatke obezbedi odgovarajuća validacija. U okviru veb prodavnice treba da postoji obezbeđeno **logovanje i autentifikacija** korisnika. Za predstavljanje podataka obezbediti **paginaciju, sortiranje i pretragu**.“*

U ovom projektu frontend je **jednostranički portal** (`spaceforwork-portal.html`, HTML/CSS/JS), što spada pod **opcioni izbor tehnologije** uz konsultaciju sa asistentom. Validacija je na klijentu gde ima smisla, a obavezno na serveru kroz **DTO + ValidationPipe** u NestJS-u.

### 2.3 Plaćanje (Zadatak IV)

Implementiran je **testni Stripe payment processor**: Checkout sesija nakon izbora proizvoda, **webhook** za detekciju uplate, prikaz podataka o transakciji administratoru (proizvod, cena, količina, kupac — preko admin pregleda porudžbina i linija porudžbine).

---

## 3. UML dijagrami

### 3.a Dijagram slučajeva upotrebe

Zahtev predmeta: *„U okviru dijagrama slučajeva upotrebe potrebno je identifikovati **ključne poslovne procese** sistema.“*

Kompletan tekstualni i Mermaid model:

- **`docs/EONIS-Zadatak-I-UML.md`** — poglavlja o UC dijagramima, master lista slučajeva i detaljni opisi (preduslov, tok, alternative).

Vizuelni izvozi za štampu / Word:

- Figmi file (pregled figura): `https://www.figma.com/design/zNUqevt9rAhpzsbWJgC6JO`  
- PNG: `docs/figma-export/png/`  
- HTML pregled: `docs/figma-export/render-all-diagrams.html`

### 3.b Dijagram klasa

Zahtev predmeta: *„Dijagram klasa treba da predstavi **statičku strukturu** sistema.“*

Opis modela, klasa, enumeracija i veza:

- **`docs/EONIS-Zadatak-I-UML.md`**, poglavlje o dijagramu klasa i relacijama između klasa.

Uz dijagrame, predmet zahteva **opise slučajeva upotrebe** i **opise relacija između klasa** — to je obuhvaćeno istim dokumentom (Zadatak I).

---

## 4. Baza podataka — proces prema izabranom pristupu

### 4.1 Izbor: **code first** (usklađeno sa Zadatkom II)

Šema se izvodi iz **TypeORM entiteta** u svakom mikroservisu. Pri razvoju je uključeno automatsko usklađivanje (`synchronize: true`). Jedna PostgreSQL baza `coworking` koristi se kao zajedničko skladište tabela koje servisi kreiraju iz svojih entiteta.

**Zašto nema triggera:** pri **code first** pristupu specifikacija predviđa realizaciju biznis logike **u programskom kodu**, ne obavezno triggerom.

### 4.2 Tabele / entiteti u skladu sa Napomenom iz Zadatka II

Specifikacija navodi osnovne tabele: **proizvod/artikal/usluga**, **korisnik**, **zaposleni/admin**, **porudžbina**, uz **asocijativne klase** po potrebi.

| Koncept | Implementacija |
|---------|----------------|
| Korisnik + admin | Tabela `users`, kolona `role` (`admin` \| `member`), kolona `isActive` (soft deaktivacija) |
| Proizvod | Tabela `products` (commerce-service) |
| Porudžbina | Tabela `orders`, `order_lines` (stavka porudžbine kao veza proizvod–porudžbina + količina/cena) |
| Dodatno za coworking | `rooms`, `bookings`, `notifications` |

### 4.3 Univerzalni primeri biznis logike (Zadatak II)

Implementacija u kodu (`commerce-service`): zabrana količine veće od stanja pri checkout-u; smanjenje stanja pri potvrđenom plaćanju (webhook ili demo).

---

## 5. Opis predloženog rešenja

### 5.1 Arhitektura

**API Gateway** (JWT) proksiše ka:

| Servis | Uloga |
|--------|--------|
| user-service | Registracija, prijava, profil; **admin CRUD nad korisnicima** (lista sa paginacijom/pretragom, izmena, soft delete) |
| room-service | Javni pregled prostorija (paginacija/sort/pretraga kada su parametri prosleđeni); SSE tok; **admin CRUD** (kreiranje, izmena, soft delete) |
| booking-service | Kreiranje, čitanje, brisanje (otkazivanje) rezervacija; javna zauzetost po sobi |
| notification-service | Čitanje obaveštenja, označavanje kao pročitano; kreiranje iz RabbitMQ događaja |
| commerce-service | CRUD proizvoda (admin); checkout; moje porudžbine; admin transakcije; Stripe webhook |

### 5.2 Ispunjenje Zadatka III (sažetak)

Zahtev: *„Za svaku tabelu neophodno je kreirati CRUD operacije … sistem mora da obradi izuzetke … pretragu … minimum dve uloge … autentifikacija i autorizacija.“*

| Tabela / entitet | C | R | U | D (interpretacija u aplikaciji) |
|------------------|---|---|---|-----------------------------------|
| users | register | profil, GET po id, **admin lista** | **admin PATCH** | **admin soft delete** (`isActive=false`) |
| rooms | **admin POST** | GET lista / GET:id | **admin PATCH** | **admin DELETE** (soft `isActive`) |
| bookings | POST | GET liste / GET:id | — | DELETE (otkazivanje) |
| notifications | *(interno / MQ)* | GET | PATCH read | — *(životni vek po domenu)* |
| products | admin POST | GET paginirano | admin PATCH | admin DELETE (soft) |
| orders / order_lines | checkout | my orders, admin transakcije | status iz webhook/demo | — *(porudžbina kao proces prodaje)* |

Izuzeci: standardni HTTP odgovori NestJS-a (`BadRequestException`, `NotFoundException`, …).  
Pretraga: parametri `search` / paginacija na korisnicima, sobama, proizvodima; dodatno filtriranje u admin panelu portala.

### 5.3 Ispunjenje Zadatka IV

- Frontend portal sa validacijom i loginom.  
- Paginacija / sort / pretraga na odgovarajućim GET listama (proizvodi, sobe sa query parametrima, admin liste).  
- Stripe Checkout + webhook + admin prikaz transakcije sa stavkama.

*(Tačne URL putanje i primeri poziva: `README.md`, sekcija API Endpointi.)*

---

## 6. Zaključak

Projekat realizuje **veb prodavnicu** u smislu projektne specifikacije EONIS, proširenu o **coworking rezervacije**, uz **code first** model baze i biznis logiku u kodu, **dve uloge** (ADMIN i CUSTOMER/member), **CRUD** nad ključnim entitetima kroz REST API, **Stripe** integraciju i **projektnu dokumentaciju** u strukturi iz Zadatka V.

Dalji tehnički koraci u životnom ciklusu (van minimalnog obima predmeta): migracije umesto `synchronize`, strožije odvajanje baza po servisu, proširenje admin UI za nove REST endpoint-e za sobe.

---

## Prilog A — Rokovi iz projektne specifikacije (referenca)

- Prijava teme i tehnologija: **najkasnije do 9. 4. 2026.**  
- Odbrane projektnih zadataka: **11–13. 5. 2026.** (predrok), **22–24. 6. 2026.** (finalni rok).  
- Seminarski rad: **18. 5. 2026.**  
- Prezentacija: **15. 6. 2026.** (trajanje 10–15 min).  

*(Seminarski rad i prezentacija nisu deo ovog dokumenta, ali su predispitne obaveze po istoj specifikaciji.)*

---

## Prilog B — Matrica: zahtev PDF → artefakt u repozitorijumu

| Zahtev (skraćeno iz PDF-a) | Gde je ostvareno |
|----------------------------|------------------|
| Zadatak I: UC dijagram + ključni poslovni procesi | `docs/EONIS-Zadatak-I-UML.md`, Figmi/PNG |
| Zadatak I: dijagram klasa + opisi veza | isto |
| Zadatak II: code first **ili** database first + trigger samo kod DB first | **Code first** — poglavlje 4 ovog dokumenta; trigger nije uslov |
| Zadatak II: stanje / korpa primeri | `commerce-service` |
| Zadatak III: CRUD, izuzeci, pretraga, ADMIN + CUSTOMER, auth | Mikroservisi + Gateway; admin rute za `users`, `rooms`; vidi §5.2 |
| Zadatak IV: frontend, validacija, login, pag/sort/search | `spaceforwork-portal.html` + DTO na backendu |
| Zadatak IV: Stripe + webhook + admin transakcija | `commerce-service`, portal admin porudžbine |
| Zadatak V: šest poglavlja dokumentacije | Ovaj fajl |

---

*Za službenu predaju: prebaciti u Word/PDF sa naslovnom stranom, automatskim sadržajem i numerisanim poglavljima prema uputstvu predmeta.*
