import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { RequestContextService } from '@/common/context/request-context.service';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const store = {
      userId: request.user?.sub ?? null,
      ipAddress: request.ip ?? null,
    };

    return new Observable((subscriber) => {
      this.requestContext.run(store, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
