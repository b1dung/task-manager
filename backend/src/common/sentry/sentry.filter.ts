import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Wraps Nest's default exception filter and forwards unexpected server-side
 * (5xx) errors to Sentry. Client errors (4xx) are intentionally not reported.
 * No-op when SENTRY_DSN is unset (Sentry.captureException simply does nothing).
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      Sentry.captureException(exception);
    }

    super.catch(exception, host);
  }
}
