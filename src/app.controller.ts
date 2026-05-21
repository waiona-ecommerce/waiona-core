import { Controller, Get } from '@nestjs/common';

/**
 * Health check endpoint.
 * GET / → { status: 'ok', timestamp: '...' }
 * Útil para monitoreo, load balancers y Docker healthcheck.
 */
@Controller()
export class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
