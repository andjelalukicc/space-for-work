/**
 * HEALTH CONTROLLER - Provera zdravlja User Service-a
 *
 * Ovaj endpoint omogucava monitoringu (Prometheus, Docker healthcheck,
 * API Gateway) da proveri da li servis radi ispravno.
 *
 * GET /health vraca:
 * - status: 'ok' ili 'error'
 * - service: ime servisa
 * - uptime: koliko dugo servis radi (u sekundama)
 * - database: da li je konekcija sa bazom aktivna
 * - timestamp: trenutno vreme
 */
import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    // Proveravamo da li je konekcija sa PostgreSQL bazom aktivna
    let dbStatus = 'up';
    try {
      // Izvrsavamo jednostavan SQL upit da proverimo konekciju
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'down';
    }

    return {
      status: dbStatus === 'up' ? 'ok' : 'error',
      service: 'user-service',
      uptime: process.uptime(), // Koliko sekundi servis radi
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
