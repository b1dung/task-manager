import { UserRole } from '@shared/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  roleId?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
