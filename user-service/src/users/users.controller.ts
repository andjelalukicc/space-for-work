/**
 * USERS CONTROLLER - HTTP Endpointi za korisnike
 *
 * Ovaj fajl definise sve HTTP rute (URL-ove) za User Service:
 * - POST /users/register  -> Registracija novog korisnika
 * - POST /users/login     -> Login (vraca JWT token)
 * - GET  /users/profile   -> Profil ulogovanog korisnika (zasticeno JWT-om)
 * - GET  /users/:id       -> Podatci o korisniku po ID-u
 *
 * Controller NE sadrzi biznis logiku - sve prosledjuje UsersService-u.
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/admin.guard';
import { AdminQueryUsersDto } from './dto/admin-query-users.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Controller('users') // Sve rute u ovom kontroleru pocinju sa /users
export class UsersController {
  constructor(
    private readonly usersService: UsersService, // Biznis logika
    private readonly jwtService: JwtService, // Za kreiranje JWT tokena
  ) {}

  /**
   * POST /users/register
   * Registracija novog clana coworking prostora.
   * Body: { name, email, password }
   * ValidationPipe automatski proverava da li su podatci ispravni (prema RegisterDto)
   */
  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    const user = await this.usersService.register(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  /**
   * POST /users/login
   * Login korisnika - vraca JWT token koji se koristi za autentifikaciju.
   * Body: { email, password }
   *
   * Kako radi:
   * 1. Proveri email i lozinku
   * 2. Ako su ispravni, kreira JWT token sa: { sub: userId, email, role }
   * 3. Token istice za 24h (podeseno u users.module.ts)
   */
  @Post('login')
  async login(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    )
    loginDto: LoginDto,
  ) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Neispravan email ili lozinka');
    }

    // Kreiraj JWT payload - ovo se pakuje u token
    // "sub" je standard za Subject (ko je vlasnik tokena)
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload), // Potpisan JWT token
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * GET /users/profile
   * Vraca profil ULOGOVANOG korisnika.
   * @UseGuards(JwtAuthGuard) - ova ruta je ZASTICENA, treba validan JWT token
   * req.user se automatski popunjava iz JWT tokena (jwt.strategy.ts)
   */
  @UseGuards(JwtAuthGuard) // Zastita - bez tokena, vraca 401
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  /** ADMIN — lista korisnika (paginacija, pretraga po imenu/emailu/ulozi). */
  @UseGuards(AdminGuard)
  @Get('admin/list')
  async adminList(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    )
    query: AdminQueryUsersDto,
  ) {
    return this.usersService.adminFindPaginated(query);
  }

  /** ADMIN — izmena naloga (ime, uloga, aktivnost). */
  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  async adminPatch(
    @Param('id') id: string,
    @Body(ValidationPipe) dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(id, dto);
  }

  /** ADMIN — „brisanje“ kao deaktivacija naloga. */
  @UseGuards(AdminGuard)
  @Delete('admin/:id')
  async adminDelete(@Param('id') id: string) {
    await this.usersService.adminDeactivate(id);
    return { success: true };
  }

  /**
   * GET /users/:id
   * Vraca podatke o korisniku po ID-u.
   * Koristi se interno od strane drugih servisa.
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
