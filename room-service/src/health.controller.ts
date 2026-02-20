/**
 * HEALTH CONTROLLER - Provera zdravlja Room Service-a
 *
 * Ovaj endpoint omogucava monitoringu da proveri da li servis
 * radi ispravno i da li je konekcija sa bazom aktivna.
 *
 * GET /health vraca status servisa, uptime i stanje baze.
 */
import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    // Proveravamo konekciju sa PostgreSQL bazom
    let dbStatus = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'down';
    }

    return {
      status: dbStatus === 'up' ? 'ok' : 'error',
      service: 'room-service',
      uptime: process.uptime(),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
