# Migracija na odvojene baze po servisu

PostgreSQL i dalje radi kao **jedan kontejner**, ali svaki mikroservis koristi **sopstvenu `DATABASE`** (`coworking_users`, `coworking_rooms`, …).

## Prvi put (čist volumen)

```bash
docker compose down -v
docker compose up --build -d
```

Skripta `docker/postgres/init/01-extra-databases.sql` izvršava se **samo pri prvom kreiranju** volumena `postgres_data`.

## Ako već imaš stari volumen (samo `coworking` baza)

Init se **neće** ponovo pokrenuti. Opcije:

**A)** Obrisati volumen (gubiš lokalne podatke): `docker compose down -v` pa ponovo `up`.

**B)** Ručno u psql:

```sql
CREATE DATABASE coworking_users;
CREATE DATABASE coworking_rooms;
CREATE DATABASE coworking_bookings;
CREATE DATABASE coworking_notifications;
CREATE DATABASE coworking_commerce;
```

Zatim pokreni servise — migracije će kreirati tabele u novim bazama. Stare podatke iz baze `coworking` po potrebi migriši ručno (`pg_dump` / `pg_restore` po šemi).

## TypeORM migracije

U svakom servisu: `synchronize: false`, `migrationsRun: true`, migracije u `src/migrations/`. Pri buildu se kompajliraju u `dist/migrations/`.
