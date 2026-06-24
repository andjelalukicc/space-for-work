import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ default: 'Usluga' })
  category: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @Column({ default: 'kom' })
  unit: string;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'text', nullable: true })
  shortDescription: string | null;

  @Column('simple-json', { nullable: true })
  tags: string[];

  @Column({ type: 'int', default: 9999 })
  stockQuantity: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
