// ============================================================================
// NOTIFICATIONS SERVICE - Poslovna logika za rad sa notifikacijama
// ============================================================================
// Ovaj servis sadrzi svu poslovnu logiku za notifikacije:
// - Kreiranje novih notifikacija
// - Dohvatanje notifikacija za odredjenog korisnika
// - Oznacavanje notifikacija kao procitanih
// - Obrada dogadjaja iz RabbitMQ (kreiranje/otkazivanje rezervacija)
//
// Servis koristi Repository pattern iz TypeORM-a za pristup bazi podataka.
// @Injectable() dekorator omogucava da NestJS DI (Dependency Injection)
// sistem automatski kreira i ubacuje instancu ovog servisa gde je potrebna.
// ============================================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

// @Injectable() - oznacava klasu kao NestJS provider koji se moze
// injektovati u druge klase putem konstruktora (Dependency Injection).
@Injectable()
export class NotificationsService {
  constructor(
    // @InjectRepository(Notification) - injektuje TypeORM repozitorijum
    // za Notification entitet. Repository pruza metode za CRUD operacije
    // nad bazom (find, save, create, delete, itd.) bez pisanja SQL-a.
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  // create() - kreira novu notifikaciju u bazi podataka.
  // Prima userId (kome je notifikacija), type (vrsta) i message (tekst).
  // Koristi dva koraka:
  //   1. create() - pravi instancu entiteta u memoriji (ne cuva u bazu)
  //   2. save() - cuva instancu u bazu i vraca sacuvani objekat sa ID-jem
  async create(
    userId: string,
    type: string,
    message: string,
  ): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId,
      type,
      message,
    });
    return this.notificationsRepository.save(notification);
  }

  // findByUser() - dohvata sve notifikacije za odredjenog korisnika.
  // Rezultati su sortirani po datumu kreiranja u opadajucem redosledu (DESC),
  // tako da najnovije notifikacije budu prve u listi.
  // API Gateway prosledjuje userId kroz x-user-id header.
  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // markAsRead() - oznacava notifikaciju kao procitanu.
  // Prvo trazi notifikaciju po ID-ju. Ako ne postoji, baca NotFoundException
  // (HTTP 404 greska). Ako postoji, postavlja isRead na true i cuva u bazu.
  // Ovo se poziva kada korisnik klikne na notifikaciju u frontend-u.
  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }

  // handleBookingCreated() - obradjuje dogadjaj kada je nova rezervacija kreirana.
  // Ova metoda se poziva iz kontrolera kada stigne 'booking_created' event
  // iz RabbitMQ reda. Booking servis emituje ovaj event kada korisnik
  // uspesno napravi rezervaciju. Metoda konstruise citljivu poruku
  // i kreira notifikaciju tipa 'booking_created' za korisnika.
  async handleBookingCreated(data: {
    bookingId: string;
    userId: string;
    roomId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) {
    const message = `Booking confirmed: ${data.date} from ${data.startTime} to ${data.endTime}`;
    return this.create(data.userId, 'booking_created', message);
  }

  // handleBookingCancelled() - obradjuje dogadjaj kada je rezervacija otkazana.
  // Ova metoda se poziva iz kontrolera kada stigne 'booking_cancelled' event
  // iz RabbitMQ reda. Booking servis emituje ovaj event kada korisnik
  // otkaze svoju rezervaciju. Metoda konstruise poruku o otkazivanju
  // i kreira notifikaciju tipa 'booking_cancelled' za korisnika.
  async handleBookingCancelled(data: {
    bookingId: string;
    userId: string;
    roomId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) {
    const message = `Booking cancelled: ${data.date} from ${data.startTime} to ${data.endTime}`;
    return this.create(data.userId, 'booking_cancelled', message);
  }
}
