import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = `${request.ip}:${request.method}:${request.path}`;
    const current = RateLimitGuard.attempts.get(key);
    if (!current || current.resetAt <= now) {
      RateLimitGuard.attempts.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (current.count >= 10) {
      throw new HttpException(
        'Too many requests; try again in one minute',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    current.count += 1;
    return true;
  }
}
