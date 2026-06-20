import { apiClient } from './client'
import type { AuthUser } from '@/stores/useAuthStore'

export interface LoginDto { email: string; password: string }
/** Public registration sends `email`; invite registration sends `token` (email comes from the invite). */
export interface RegisterDto { email?: string; password: string; fullName: string; token?: string }
export interface AuthResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}
/** Register either activates immediately (invite) or creates a pending account. */
export type RegisterResult =
  | { status: 'active'; user: AuthUser; accessToken: string; refreshToken: string }
  | { status: 'pending'; user: AuthUser }

export const authApi = {
  login: (dto: LoginDto) =>
    apiClient.post<{ success: true; data: AuthResponse }>('/auth/login', dto).then((r) => r.data.data),
  register: (dto: RegisterDto) =>
    apiClient.post<{ success: true; data: RegisterResult }>('/auth/register', dto).then((r) => r.data.data),
  logout: () => apiClient.post('/auth/logout', {}),
  me: () =>
    apiClient.get<{ success: true; data: AuthUser }>('/auth/me').then((r) => r.data.data),
}
