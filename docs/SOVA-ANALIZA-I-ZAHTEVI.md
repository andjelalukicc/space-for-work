# SOVA analiza i zahtevi za projekat EONIS 2025/26

**Kurs:** Eksploatacija, odrzavanje i nadogradnja informacionih sistema 2025/26 IIS  
**SOVA strana:** https://sova.uns.ac.rs/course/view.php?id=5077  
**Rok za predaju projektne dokumentacije:** sreda, 24. jun 2026. u 23:59  
**Projekat:** Space For Work coworking portal, booking sistem i prodaja usluga  
**GitHub:** https://github.com/andjelalukicc/space-for-work

Ovaj dokument je radna beleška za projekat. Nije prepis materijala sa SOVA platforme, vec sazet pregled onoga sto je za nas projekat bitno: sta predmet trazi, koje teme iz predavanja treba pomenuti u dokumentaciji i kako se vezbe za Stripe/Webhooks preslikavaju na implementaciju.

## 1. Struktura SOVA kursa

Na kursu su vidljive cetiri prakticno vazne celine:

| Sekcija | Sadrzaj | Uloga za projekat |
|---|---|---|
| Opsta sekcija | Announcements, 01 Uvodno predavanje | Uvod u predmet i nacin rada. |
| Projektni zadatak | Projektna specifikacija EONIS 2026, Predaja projektne dokumentacije | Glavni izvor zahteva koje sistem i dokumentacija moraju da pokriju. |
| Materijali sa predavanja | 02-13: zivotni ciklus IS, odrzavanje, monitoring, incidenti, problemi, dostupnost, kapaciteti, baze, bezbednost, konfiguracije, nadogradnje, migracije, vendor management, DevOps | Teorijska osnova za obrazlozenje arhitekture, odrzavanja, monitoringa i buducih nadogradnji. |
| Materijali sa vezbi | Payment processors, Webhooks | Direktno vazno za Zadatak IV: Stripe test placanje, transakcije i webhook. |

## 2. Projektna specifikacija - obavezni zahtevi

Specifikacija za projekat trazi veb prodavnicu. Tema i tehnologije su slobodnije, pa je coworking prostor uzet kao realna usluzna prodavnica: prodaju se paketi, clanstva, sale, Virtual Office i privatne kancelarije.

| Zadatak | Sta mora da postoji | Kako se radi u ovom projektu |
|---|---|---|
| I | Use case dijagram, dijagram klasa, opisi slucajeva upotrebe i opisi relacija | `docs/EONIS-Zadatak-I-UML.md`, PNG dijagrami u `docs/figma-export/png/`, Word dokument ukljucuje pregled. |
| II | Code first ili database first; ako je database first, potreban je trigger; ako je code first, biznis logika je u kodu | Izabran je code first: NestJS + TypeORM entiteti + migracije. Logika je u servisima, posebno booking i commerce. |
| III | CRUD, obrada izuzetaka, pretraga, minimum ADMIN + CUSTOMER/USER, autentifikacija i autorizacija | User, Room, Booking, Notification, Product i Order servisi; JWT preko API Gateway-a; admin guard u servisima. |
| IV | Frontend validacija, login, paginacija/sort/pretraga, Stripe test payment processor, webhook, admin prikaz transakcija | Portal + API Gateway + commerce-service. Test mod radi i bez Stripe kljuca, a realni Stripe se ukljucuje preko env promenljivih. |
| V | Projektna dokumentacija: realni sistem, tehnologije, UML, baza, resenje, zakljucak | `docs/build_spaceforwork_documentation.py` generise finalni Word dokument. |

## 3. Bitne poruke iz predavanja

Predavanja pokrivaju zivotni ciklus informacionog sistema i kasnije faze eksploatacije. Za ovaj projekat je vazno da dokumentacija ne prikazuje samo "lep sajt", vec sistem koji moze da se odrzava:

- **Zivotni ciklus IS:** sistem se razvija kroz iteracije: prvo javni portal, zatim booking, zatim admin panel, zatim placanje i monitoring.
- **Tipovi odrzavanja:** korektivno odrzavanje za greske, adaptivno za promene poslovanja, perfektivno za UX i performanse, preventivno za sigurnost i stabilnost.
- **Monitoring i incidenti:** health endpointi, Prometheus i Grafana omogucavaju pracenje rada servisa; incident se prati kroz logove i status servisa.
- **Dostupnost i kapaciteti:** coworking booking mora da spreci preklapanja termina i da postuje kapacitet prostora, sto je domenska dostupnost.
- **Baze i bezbednost:** JWT, hash lozinki, role-based pristup i server-side validacija cuvaju integritet podataka.
- **Konfiguracije i nadogradnje:** Docker Compose, env promenljive i migracije omogucavaju kontrolisano pustanje novih verzija.
- **Migracije podataka:** uvoz `Office Members.xlsx` je primer pocetne migracije realne baze clanova u sistem.
- **DevOps i kontinuirana isporuka:** CI/CD, Docker, monitoring i servisna podela pokazuju da projekat prati teme predmeta.

## 4. Payment processors - sta treba preneti u projekat

Materijal sa vezbi objasnjava da online placanje ukljucuje kupca, prodavca, payment processor i payment gateway. Za nas projekat to znaci:

- korisnik bira coworking paket ili uslugu;
- backend kreira porudzbinu i Stripe Checkout sesiju;
- Stripe obraduje karticne podatke na svojoj strani, pa aplikacija ne cuva osetljive karticne podatke;
- u test modu koristi se Stripe test kartica;
- admin mora da vidi sta je placeno: paket/usluga, cenu, kolicinu, status, kupca i referencu transakcije.

Najvazniji razlog za Stripe Checkout je jednostavnost i sigurnost: aplikacija dobija potvrdu placanja, ali ne implementira sama obradu kartice.

## 5. Webhooks - sta treba preneti u projekat

Webhook materijal naglasava da Stripe salje dogadjaje aplikaciji u realnom vremenu kao HTTPS/JSON POST zahteve. Za projekat su najbitniji sledeci principi:

- webhook endpoint je backend ruta koja prima Stripe dogadjaje;
- endpoint mora da procita tip dogadjaja, npr. `checkout.session.completed`;
- endpoint treba da proveri `Stripe-Signature` pomocu webhook secreta;
- odgovor mora brzo da bude 2xx, da Stripe ne bi ponavljao slanje kao neuspesno;
- posle uspesnog dogadjaja sistem azurira porudzbinu u `paid`, upisuje payment intent i smanjuje dostupno stanje proizvoda/usluge.

U projektu je to implementirano u `commerce-service/src/webhooks/stripe-webhook.controller.ts` i `commerce-service/src/orders/orders.service.ts`.

## 6. Mapa SOVA zahteva na trenutni projekat

| Zahtev / tema | Status |
|---|---|
| Use case i class dijagram | Uradjeno kroz Markdown + PNG dijagrame, ukljucuje tekstualne opise. |
| Code first baza | Uradjeno kroz TypeORM entitete i migracije u mikroservisima. |
| CRUD | Uradjeno za korisnike, sobe, proizvode; rezervacije i porudzbine imaju procesne operacije. |
| Role ADMIN i CUSTOMER/USER | Uradjeno kroz `admin` i `member` uloge. |
| Login/JWT | Uradjeno kroz user-service i api-gateway. |
| Frontend validacija | Uradjeno u portalu; backend DTO validacija postoji kao autoritativna zastita. |
| Paginacija/sort/pretraga | Postoji na API listama za katalog/sobe/korisnike i u admin prikazima. |
| Stripe test | Uradjeno kao backend Checkout + fallback demo test tok bez placanja karticom. |
| Webhook | Uradjeno direktno u commerce-service, spremno za Stripe CLI/live test kljuceve. |
| Admin transakcije | Uradjeno kroz commerce admin rute i admin panel. |
| Dokumentacija | Generator se azurira da finalni Word prati implementaciju i zahteve. |

## 7. Sta je najvaznije za predaju veceras

1. Finalni Word/PDF dokument treba da bude uskladjen sa stvarnim kodom.
2. Treba jasno objasniti da je projekat code first, pa trigger nije obavezan.
3. Treba pokazati da coworking usluge predstavljaju "proizvode/usluge" web prodavnice.
4. Stripe/Webhook ne sme ostati samo ideja: mora se pomenuti konkretan `commerce-service`, endpoint i tok placanja.
5. Dokumentacija treba da ima UML dijagrame, matricu zahteva i prirodan zakljucak.
