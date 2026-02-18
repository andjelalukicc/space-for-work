import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

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

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

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
