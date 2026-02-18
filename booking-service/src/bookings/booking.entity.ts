import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  roomId: string;

  @Column('date')
  date: string; // YYYY-MM-DD

  @Column('time')
  startTime: string; // HH:MM

  @Column('time')
  endTime: string; // HH:MM

  @Column({ default: 'active' })
  status: string; // 'active' | 'cancelled'

  @CreateDateColumn()
  createdAt: Date;
}
