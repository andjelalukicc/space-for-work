import { Controller, Get, Param, Query, Sse } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Observable, map } from 'rxjs';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    return this.roomsService.findAll();
  }

  @Get('type/:type')
  async findByType(@Param('type') type: string) {
    return this.roomsService.findByType(type);
  }

  @Sse('availability/stream')
  availabilityStream(): Observable<MessageEvent> {
    return this.roomsService.getAvailabilityStream().pipe(
      map((data) => ({
        data: JSON.stringify(data),
      }) as MessageEvent),
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.roomsService.findById(id);
  }
}
