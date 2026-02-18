/**
 * USER ENTITY - Model korisnika u bazi podataka
 *
 * Ova klasa definise kako tabela 'users' izgleda u PostgreSQL bazi.
 * TypeORM automatski kreira tabelu na osnovu ovih dekoratora (@Column, itd.)
 *
 * Tabela 'users' cuva podatke o svim clanovima coworking prostora.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users') // Ime tabele u bazi ce biti 'users'
export class User {
  @PrimaryGeneratedColumn('uuid') // Automatski generise jedinstveni UUID kao primarni kljuc
  id: string;

  @Column() // Obicna kolona - ime korisnika
  name: string;

  @Column({ unique: true }) // Email mora biti jedinstven - dva korisnika ne mogu imati isti
  email: string;

  @Column() // Lozinka se cuva kao HASH (bcrypt) - nikad plaintext!
  password: string;

  @Column({ default: 'member' }) // Uloga korisnika, podrazumevano 'member'
  role: string;

  @CreateDateColumn() // Automatski se popunjava kada se korisnik kreira
  createdAt: Date;

  @UpdateDateColumn() // Automatski se azurira kada se korisnik menja
  updatedAt: Date;
}
