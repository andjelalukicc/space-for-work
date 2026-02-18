import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';
import { Subject } from 'rxjs';

@Injectable()
export class RoomsService implements OnModuleInit {
  private availabilitySubject = new Subject<{ roomId: string; event: string }>();

  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  async onModuleInit() {
    await this.seedRooms();
  }

  private async seedRooms() {
    const count = await this.roomsRepository.count();
    if (count > 0) return;

    const rooms = [
      {
        name: 'Meeting Room Small',
        type: 'meeting_room',
        capacity: 8,
        amenities: ['Smart TV', 'Whiteboard'],
      },
      {
        name: 'Meeting Room Large',
        type: 'meeting_room',
        capacity: 20,
        amenities: ['Smart TV', 'Whiteboard'],
      },
      { name: 'Phone Booth 1', type: 'phone_booth', capacity: 1, amenities: [] },
      { name: 'Phone Booth 2', type: 'phone_booth', capacity: 1, amenities: [] },
      { name: 'Phone Booth 3', type: 'phone_booth', capacity: 1, amenities: [] },
      { name: 'Phone Booth 4', type: 'phone_booth', capacity: 1, amenities: [] },
      { name: 'Phone Booth 5', type: 'phone_booth', capacity: 1, amenities: [] },
      { name: 'Phone Booth 6', type: 'phone_booth', capacity: 1, amenities: [] },
    ];

    for (const room of rooms) {
      const entity = this.roomsRepository.create(room);
      await this.roomsRepository.save(entity);
    }

    console.log('Seeded 8 rooms (2 meeting rooms + 6 phone booths)');
  }

  async findAll(): Promise<Room[]> {
    return this.roomsRepository.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async findByType(type: string): Promise<Room[]> {
    return this.roomsRepository.find({ where: { type, isActive: true } });
  }

  emitAvailabilityChange(roomId: string, event: string) {
    this.availabilitySubject.next({ roomId, event });
  }

  getAvailabilityStream() {
    return this.availabilitySubject.asObservable();
  }
}
