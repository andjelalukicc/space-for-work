import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Body(ValidationPipe) createBookingDto: CreateBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.create(userId, createBookingDto);
  }

  @Get()
  async findByUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.findByUser(userId);
  }

  @Get('room/:roomId')
  async findByRoom(
    @Param('roomId') roomId: string,
    @Query('date') date: string,
  ) {
    return this.bookingsService.findByRoom(roomId, date);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('User ID is required');
    }
    return this.bookingsService.cancel(id, userId);
  }
}
