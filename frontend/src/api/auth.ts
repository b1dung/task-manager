import { apiClient } from './client'
import type { AuthUser } from '@/stores/useAuthStore'

export interface LoginDto { email: string; password: string; otp?: string }
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
  forgotPassword: (email: string) =>
    apiClient.post('/auth/password/forgot', { email }),
  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/password/reset', { token, password }),
  verifyEmail: (token: string) =>
    apiClient.post('/auth/email/verify', { token }),
  resendVerification: () => apiClient.post('/auth/email/resend'),
  sessions: () =>
    apiClient.get<{ success: true; data: Array<{ id: string; createdAt: string; expiresAt: string }> }>('/auth/sessions').then((r) => r.data.data),
  revokeSession: (id: string) => apiClient.delete(`/auth/sessions/${id}`),
  revokeAllSessions: () => apiClient.delete('/auth/sessions'),
  setupTwoFactor: () =>
    apiClient.post<{ success: true; data: { secret: string; uri: string } }>('/auth/2fa/setup').then((r) => r.data.data),
  enableTwoFactor: (code: string) => apiClient.post('/auth/2fa/enable', { code }),
  disableTwoFactor: (code: string) => apiClient.post('/auth/2fa/disable', { code }),
}
