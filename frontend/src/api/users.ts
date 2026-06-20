import { apiClient } from './client'

export interface AppUser {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
  role: string
  roleId: string | null
  isActive: boolean
  createdAt: string
}

export interface CreateUserDto {
  email: string
  password: string
  fullName: string
  role?: string
}

export interface UpdateUserDto {
  fullName?: string
  email?: string
  role?: string
  roleId?: string | null
  isActive?: boolean
}

export const usersApi = {
  list: (q?: string) =>
    apiClient
      .get<{ success: true; data: AppUser[] }>('/users', { params: q ? { q } : undefined })
      .then((r) => r.data.data),

  get: (id: string) =>
    apiClient
      .get<{ success: true; data: AppUser }>(`/users/${id}`)
      .then((r) => r.data.data),

  create: (dto: CreateUserDto) =>
    apiClient
      .post<{ success: true; data: AppUser }>('/users', dto)
      .then((r) => r.data.data),

  update: (id: string, dto: UpdateUserDto) =>
    apiClient
      .patch<{ success: true; data: AppUser }>(`/users/${id}`, dto)
      .then((r) => r.data.data),

  uploadAvatar: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .patch<{ success: true; data: AppUser }>(`/users/${id}/avatar`, form, {
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data.data)
  },
}
