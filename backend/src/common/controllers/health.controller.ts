import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'UP';
    let dbLatencyMs = 0;

    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'DOWN';
    }

    return {
      status: dbStatus === 'UP' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
    };
  }
}
