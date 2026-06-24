# Bezbednosni pregled (audit) — Coworking Booking System

**Datum:** maj 2026.  
**Opseg:** API Gateway, autentifikacija, javni endpoint-i, plaćanje, Docker okruženje.

## Rezime

| Oblast | Rizik | Mera u projektu |
|--------|--------|-----------------|
| Brute force na login | Visok u produkciji | **Rate limiting** na gateway-u (`@nestjs/throttler`, ~200 zahteva / min po IP; `/health` isključen) |
| HTTP zaglavlja / XSS / clickjacking | Srednji | **Helmet** na gateway-u (CSP isključen zbog Swagger UI lokalno; u produkciji strožije CSP) |
| CORS | Srednji (dev) | `origin: true` — **za produkciju** zameniti whitelistom domena fronta |
| JWT | Srednji | Isti `JWT_SECRET` na gateway i user servisu; token u `localStorage` na portalu (XSS na frontu kompromituje sesiju) — za diplomski razmotriti httpOnly cookie + CSRF |
| Servis-servis poverenje | Srednji | Gateway šalje `x-user-id` / `x-user-role` — mikroservisi **ne bi smeli** da prihvate te headere sa javnog interneta bez provere da zahtev dolazi sa gateway mreže (u Docker bridge-u je prihvatljivo; u K8s koristiti mTLS ili service mesh) |
| Stripe webhook | Visok ako nema potpisa | Verifikacija **`stripe-signature`** + raw body u `commerce-service` |
| SQL injection | Nizak | TypeORM parametrizovani upiti; validacija DTO |
| Mass assignment | Nizak | `whitelist` / `forbidNonWhitelisted` na ValidationPipe (gateway) |

## Preporuke pre produkcije

1. CORS: eksplicitna lista `https://tvoj-domen.rs`.  
2. JWT: kratki TTL + refresh token ili session store.  
3. Logovanje neuspešnih prijava i alarmiranje.  
4. `helmet` CSP uključiti kada Swagger nije javno dostupan.  
5. Zavisnosti: povremeno `npm audit` u svakom servisu.  
6. Baze: odvojene per servis (ovaj repo) + rotacija lozinke DB korisnika.

## Šta ovaj dokument nije

Pen-test spoljašnjeg izvođača niti formalni certifikacioni audit — služi kao **studentski/tehnički checklist** za odbranu i diplomski.
