# Detaljni pregled: Projektna specifikacija EONIS 2025/26 ↔ implementacija

**Student:** Andjela Lukic — **IT62/2022**  
**Projekat:** Coworking Booking System (mikroservisi + portal)  
**Izvorna specifikacija (PDF):** `Projektna specifikacija EONIS 2026.pdf` (na Desktopu)  
**Datum ovog dokumenta:** maj 2026.

Ovaj fajl služi za **odbranu** i za **diplomski**: gde je šta u kodu, šta tačno traži predmet i kako je ostvareno.

---

## 1. Šta projektni zadatak uopšte traži (iz PDF-a)

| Segment | Poeni / uloga | Šta treba (suština) |
|---------|----------------|---------------------|
| Projektni zadatak | 50 poena | Veb prodavnica + izabrana tema + tehnologije uz asistenta |
| Seminarski | 10 poena | Teorijski deo (12–15 str.), kasnije sjedinjen sa Zadatkom V |
| Prezentacija | 10 poena | 10–15 min, rok 15. 6. 2026. |

**Rokovi (iz PDF-a):** prijava teme do **9. 4. 2026.**; odbrane **11–13. 5.** i **22–24. 6. 2026.**; seminarski **18. 5. 2026.**

---

## 2. Zadatak I — UML

**Tekst iz specifikacije:** dijagram slučajeva upotrebe (uključujući **ključne poslovne procese**), dijagram klasa (**statička struktura**), prateći **opisi UC** i **opisi relacija** između klasa.

| Zahtev | Gde je urađeno |
|--------|----------------|
| UC + poslovni procesi + opisi | `docs/EONIS-Zadatak-I-UML.md` |
| Dijagram klasa + relacije | isti fajl, poglavlja 5–6 |
| Slike za štampu / Word | `docs/figma-export/png/`, Figmi fajl (link u Zadataku V), `render-all-diagrams.html` |

---

## 3. Zadatak II — Baza i biznis logika

**Izbor (PDF):** **code first** *ili* **database first**.

- **Database first:** baza prva; **obavezan minimum jedan trigger** za biznis logiku.  
- **Code first:** ista logika u **programskom kodu** (trigger nije uslov).

**Ovaj projekat = code first**

| Pitanje | Odgovor |
|---------|---------|
| Gde je „baza“? | **PostgreSQL 16**, jedna baza `coworking`, host u Docker Compose-u (`postgres`, port **5432**). Kredencijali u `docker-compose.yml`: user `coworking`, lozinka u env-u servisa. |
| Kako nastaju tabele? | **TypeORM** entiteti u svakom servisu + `synchronize: true` u razvoju — šema prati klase (`user.entity.ts`, `room.entity.ts`, `booking.entity.ts`, …). |
| Gde je logika „stanje / korpa“? | **`commerce-service`** — `orders.service.ts`: pri checkout-u ne može `quantity > stockQuantity`; pri `paid` smanjuje se `stockQuantity` na `Product`. |

**Fajlovi za odbranu „pokaži kod“:**

- `commerce-service/src/orders/orders.service.ts` — checkout, demo pay, `markPaidFromStripeSession`  
- `commerce-service/src/webhooks/stripe-webhook.controller.ts` — webhook  
- `docker-compose.yml` — servis `postgres` i `DB_*` env u servisima  

---

## 4. Zadatak III — CRUD, izuzeci, pretraga, uloge

**Tekst iz specifikacije:** CRUD za tabele u backendu, obrada izuzetaka, pretraga, **minimum ADMIN + CUSTOMER/USER**, autentifikacija i autorizacija.

| Tabela / domen | CRUD (api-gateway prefiks `/api/...`) | Kod (servis) |
|----------------|----------------------------------------|----------------|
| Korisnik | register (C), profile (R), GET :id (R), **admin lista / patch / soft delete** | `user-service/src/users/` |
| Prostorija | GET javno; **GET admin/list** (sve sobe uključujući neaktivne); **admin POST/PATCH/DELETE** | `room-service/src/rooms/` |
| Rezervacija | POST, GET, DELETE | `booking-service/src/bookings/` |
| Obaveštenje | GET, PATCH read | `notification-service/` |
| Proizvod | GET javno; admin POST/PATCH/DELETE | `commerce-service/src/products/` |
| Porudžbina | checkout, my orders, admin transakcije | `commerce-service/src/orders/` |

**JWT:** `user-service` izdaje token; **`api-gateway`** validira i šalje `x-user-id`, `x-user-role`. Uloge: `admin`, `member` (mapira se na CUSTOMER).

**Gateway rutiranje:** `api-gateway/src/app.controller.ts`.

---

## 5. Zadatak IV — Frontend, validacija, lista, Stripe

**Tekst iz specifikacije:** frontend sa validacijom; login; **paginacija, sortiranje, pretraga**; **Stripe test** + **webhook**; admin vidi **transakciju** (proizvod, cena, količina, kupac).

| Zahtev | Implementacija |
|--------|----------------|
| Frontend | `spaceforwork-portal.html` (opcioni stek — nije obavezan Angular/Vue/React ako je dogovoreno) |
| Login | forma → `POST /api/users/login` → čuvanje JWT |
| Paginacija / sort / pretraga | npr. `GET /api/commerce/products?page=&limit=&sort=&order=&search=`; sobe `GET /api/rooms?...` |
| Stripe | `commerce-service` — `createCheckout`, redirect URL |
| Webhook | `POST` na commerce: `/webhooks/stripe` (kroz gateway ili direktno na port 3005 uz Stripe CLI) |
| Admin transakcije | `GET /api/commerce/orders/admin/transactions` + panel u portalu |

---

## 6. Zadatak V — Projektnu dokumentacija

| Poglavlje (1–6 iz PDF-a) | Fajl |
|--------------------------|------|
| Cela struktura | `docs/EONIS-Zadatak-V-Projektna-dokumentacija.md` |

Za Word: prebaciti taj Markdown u Word sa naslovnom stranom i sadržajem.

---

## 7. Kako pokrenuti sve lokalno (kratko)

```bash
cd /putanja/do/ovog/foldera
docker compose up --build -d
```

Zatim otvori portal preko **lokalnog HTTP servera** (da `fetch` ka `localhost:3000` radi bez CORS problema sa `file://`):

```bash
# iz korena projekta, drugi terminal:
python3 -m http.server 8888
# browser: http://127.0.0.1:8888/spaceforwork-portal.html
```

Demo nalozi (seed): `admin@spaceforwork.rs` / `admin123`, `korisnik@spaceforwork.rs` / `korisnik123` (vidi `README.md`).

---

## 8. Mapa „gde je šta“ (najčešća pitanja na odbrani)

| Tema | Putanja |
|------|---------|
| Portal (UI) | `spaceforwork-portal.html` |
| Gateway | `api-gateway/src/app.controller.ts` |
| Login / JWT | `user-service/src/users/users.controller.ts`, `jwt.strategy.ts` |
| Rezervacije | `booking-service/src/bookings/` |
| Commerce / Stripe | `commerce-service/src/orders/`, `webhooks/` |
| Docker / baza | `docker-compose.yml` |
| UML tekst | `docs/EONIS-Zadatak-I-UML.md` |
| Projektnu dokumentacija | `docs/EONIS-Zadatak-V-Projektna-dokumentacija.md` |

---

*Napomena: `node_modules` nisu kopirani u ovaj Desktop folder radi veličine — u kopiji pokreni `npm install` u svakom servisu + gateway pre builda, ili koristi isključivo `docker compose build` koji instalira zavisnosti u kontejneru.*
