import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Resolves the effective permission keys for the current request,
 * populated by PermissionsGuard. Empty array if the guard did not run.
 */
export const UserPermissions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { userPermissions?: string[] }>();
    return request.userPermissions ?? [];
  },
);
