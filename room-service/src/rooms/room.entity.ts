import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // 'meeting_room' | 'phone_booth'

  @Column()
  capacity: number;

  @Column('simple-array', { nullable: true })
  amenities: string[]; // ['Smart TV', 'Whiteboard']

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
