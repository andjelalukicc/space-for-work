import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderLine } from './order-line.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ default: 'eur' })
  currency: string;

  @Column({ nullable: true })
  stripeSessionId: string | null;

  @Column({ nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ nullable: true })
  cardLast4: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => OrderLine, (line) => line.order, { cascade: true })
  lines: OrderLine[];

  @CreateDateColumn()
  createdAt: Date;
}
