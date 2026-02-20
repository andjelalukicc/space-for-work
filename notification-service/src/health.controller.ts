/**
 * HEALTH CONTROLLER - Provera zdravlja Notification Service-a
 *
 * Ovaj endpoint proverava da li servis radi ispravno,
 * ukljucujuci konekciju sa PostgreSQL bazom podataka.
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
      service: 'notification-service',
      uptime: process.uptime(),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
