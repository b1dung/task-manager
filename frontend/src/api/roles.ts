import { apiClient } from './client'

export interface Role {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  sortOrder: number
  createdAt: string
}

export interface PermissionDef {
  key: string
  label: string
  category: string
  description: string
}

export interface RoleInput {
  name?: string
  description?: string
  permissions?: string[]
}

export interface EffectivePermissions {
  roleId: string | null
  roleKey: string | null
  permissions: string[]
}

export const rolesApi = {
  listRoles: () =>
    apiClient
      .get<{ success: true; data: Role[] }>('/roles')
      .then((r) => r.data.data),

  listPermissions: () =>
    apiClient
      .get<{ success: true; data: PermissionDef[] }>('/permissions')
      .then((r) => r.data.data),

  myPermissions: () =>
    apiClient
      .get<{ success: true; data: EffectivePermissions }>('/me/permissions')
      .then((r) => r.data.data),

  create: (dto: RoleInput) =>
    apiClient
      .post<{ success: true; data: Role }>('/roles', dto)
      .then((r) => r.data.data),

  update: (id: string, dto: RoleInput) =>
    apiClient
      .patch<{ success: true; data: Role }>(`/roles/${id}`, dto)
      .then((r) => r.data.data),

  remove: (id: string) => apiClient.delete(`/roles/${id}`),
}
