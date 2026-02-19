/**
 * METRICS CONTROLLER - Endpoint za Prometheus monitoring
 *
 * Prometheus periodicno (svakih 15s) poziva GET /metrics
 * i prikuplja metrike o radu servisa:
 * - Broj HTTP zahteva
 * - Trajanje zahteva
 * - Memorija i CPU
 *
 * Ove metrike se zatim prikazuju u Grafana dashboard-u.
 */
import { Controller, Get, Res } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

// Prikupljamo podrazumevane Node.js metrike (memorija, CPU, event loop)
collectDefaultMetrics();

@Controller()
export class MetricsController {
  // GET /metrics - vraca metrike u Prometheus formatu
  @Get('metrics')
  async getMetrics(@Res() res: any) {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
