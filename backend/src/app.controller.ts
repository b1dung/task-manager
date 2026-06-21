import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { RedisService } from '@/common/redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/live')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async readiness(): Promise<{ status: 'ok' }> {
    try {
      await Promise.all([this.dataSource.query('SELECT 1'), this.redis.ping()]);
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException(
        'A required dependency is unavailable',
      );
    }
  }
}
