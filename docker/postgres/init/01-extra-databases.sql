-- Odvojene baze po mikroservisu (isti PostgreSQL server).
-- Izvršava se samo pri prvom inicijalizovanju volumena.

CREATE DATABASE coworking_users;
CREATE DATABASE coworking_rooms;
CREATE DATABASE coworking_bookings;
CREATE DATABASE coworking_notifications;
CREATE DATABASE coworking_commerce;
