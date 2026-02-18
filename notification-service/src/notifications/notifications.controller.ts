import {
  Controller,
  Get,
  Patch,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @EventPattern('booking_created')
  async handleBookingCreated(@Payload() data: any) {
    console.log('Received booking_created event:', data);
    return this.notificationsService.handleBookingCreated(data);
  }

  @EventPattern('booking_cancelled')
  async handleBookingCancelled(@Payload() data: any) {
    console.log('Received booking_cancelled event:', data);
    return this.notificationsService.handleBookingCancelled(data);
  }

  @Get()
  async findByUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.notificationsService.findByUser(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
