import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';
export const ANY_PERMISSIONS_KEY = 'any_required_permissions';

/**
 * Require the current user's effective role to grant ALL of the given
 * permission keys. Used together with PermissionsGuard.
 */
export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireAnyPermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
