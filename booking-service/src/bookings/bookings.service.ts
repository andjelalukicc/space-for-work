import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
    @Inject('NOTIFICATIONS_SERVICE') private notificationsClient: ClientProxy,
  ) {}

  async create(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<Booking> {
    const { roomId, date, startTime, endTime } = createBookingDto;

    // Validate: minimum 30 minutes
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }
    if (end - start < 30) {
      throw new BadRequestException('Minimum booking duration is 30 minutes');
    }
    if (start % 30 !== 0 || end % 30 !== 0) {
      throw new BadRequestException(
        'Times must be in 30-minute intervals (e.g., 09:00, 09:30, 10:00)',
      );
    }

    // Check max 3 active bookings per user per day
    const userBookingsToday = await this.bookingsRepository.count({
      where: { userId, date, status: 'active' },
    });
    if (userBookingsToday >= 3) {
      throw new ConflictException(
        'Maximum 3 active bookings per day reached',
      );
    }

    // Check room availability (no overlapping bookings)
    const overlapping = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId })
      .andWhere('booking.date = :date', { date })
      .andWhere('booking.status = :status', { status: 'active' })
      .andWhere('booking.startTime < :endTime', { endTime })
      .andWhere('booking.endTime > :startTime', { startTime })
      .getCount();

    if (overlapping > 0) {
      throw new ConflictException(
        'This time slot is already booked for this room',
      );
    }

    // Check user doesn't have overlapping bookings in ANY room
    const userOverlapping = await this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.userId = :userId', { userId })
      .andWhere('booking.date = :date', { date })
      .andWhere('booking.status = :status', { status: 'active' })
      .andWhere('booking.startTime < :endTime', { endTime })
      .andWhere('booking.endTime > :startTime', { startTime })
      .getCount();

    if (userOverlapping > 0) {
      throw new ConflictException(
        'You already have a booking during this time',
      );
    }

    const booking = this.bookingsRepository.create({
      userId,
      roomId,
      date,
      startTime,
      endTime,
    });

    const saved = await this.bookingsRepository.save(booking);

    // Emit event to notification service
    this.notificationsClient.emit('booking_created', {
      bookingId: saved.id,
      userId,
      roomId,
      date,
      startTime,
      endTime,
    });

    return saved;
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { userId },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({ where: { id } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async findByRoom(roomId: string, date: string): Promise<Booking[]> {
    return this.bookingsRepository.find({
      where: { roomId, date, status: 'active' },
      order: { startTime: 'ASC' },
    });
  }

  async cancel(id: string, userId: string): Promise<Booking> {
    const booking = await this.findById(id);

    if (booking.userId !== userId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = 'cancelled';
    const saved = await this.bookingsRepository.save(booking);

    // Emit event to notification service
    this.notificationsClient.emit('booking_cancelled', {
      bookingId: saved.id,
      userId,
      roomId: booking.roomId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });

    return saved;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
