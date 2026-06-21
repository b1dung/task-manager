import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';
import { RedisService } from '@/common/redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as { email?: string; token?: string } | undefined;
    const queryToken =
      typeof request.query?.token === 'string' ? request.query.token : '';
    const principal = (body?.email ?? body?.token ?? queryToken)
      .trim()
      .toLowerCase();
    const identity = `${request.ip}:${request.method}:${request.path}:${principal}`;
    const digest = createHash('sha256').update(identity).digest('hex');
    const key = `rate-limit:${digest}`;
    await this.redis.ensureConnected();
    const count = await this.redis.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      1,
      key,
      60,
    );
    if (Number(count) > 10) {
      throw new HttpException(
        'Too many requests; try again in one minute',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
