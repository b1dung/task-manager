import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      db: config.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
    });
    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready' || this.client.status === 'connect') {
      await this.client.quit().catch(() => this.client.disconnect());
    } else {
      this.client.disconnect();
    }
  }
}
