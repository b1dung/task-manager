import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '@/modules/auth/decorators/require-permissions.decorator';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { RolesService } from '@/modules/roles/roles.service';

/**
 * Resolves the current user's effective permissions (from their assigned
 * dynamic role, falling back to a legacy enum mapping) and:
 *  - always attaches them to `request.userPermissions`, so controllers can
 *    branch on them (e.g. self-vs-admin edits);
 *  - enforces any permissions declared via @RequirePermissions(...).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: JwtPayload; userPermissions?: string[] }
      >();

    const user = request.user;
    if (!user) return false;

    const permissions = await this.rolesService.resolvePermissions(user);
    request.userPermissions = permissions;

    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      const anyRequired = this.reflector.getAllAndOverride<
        string[] | undefined
      >(ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
      if (
        !anyRequired?.length ||
        anyRequired.some((p) => permissions.includes(p))
      )
        return true;
      throw new ForbiddenException(
        `Missing one of required permission(s): ${anyRequired.join(', ')}`,
      );
    }

    const ok = required.every((p) => permissions.includes(p));
    if (!ok) {
      throw new ForbiddenException(
        `Missing required permission(s): ${required.join(', ')}`,
      );
    }
    return true;
  }
}
