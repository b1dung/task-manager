import { apiClient } from './client'

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  createdAt: string
}

export interface ManagedProject extends Project {
  deadline: string | null
  archivedAt: string | null
  taskCount?: number
  memberCount?: number
  owner?: { id: string; fullName: string; avatarUrl: string | null } | null
}

export interface ManagedMember {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; fullName: string; email: string; avatarUrl: string | null }
}

export interface UpdateProjectPayload {
  name?: string
  description?: string
  deadline?: string | null
}

export const projectsApi = {
  list: () =>
    apiClient.get<{ success: true; data: Project[] }>('/projects').then((r) => r.data.data),
  get: (id: string) =>
    apiClient.get<{ success: true; data: Project }>(`/projects/${id}`).then((r) => r.data.data),
  create: (dto: { name: string; slug?: string; description?: string }) =>
    apiClient.post<{ success: true; data: Project }>('/projects', dto).then((r) => r.data.data),
  update: (id: string, dto: Partial<{ name: string; description: string }>) =>
    apiClient.patch<{ success: true; data: Project }>(`/projects/${id}`, dto).then((r) => r.data.data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),

  // ── Cross-project administration (admin/owner) ──
  manageList: () =>
    apiClient.get<{ success: true; data: ManagedProject[] }>('/manage/projects').then((r) => r.data.data),
  manageCreate: (dto: { name: string; slug?: string; description?: string }) =>
    apiClient.post<{ success: true; data: Project }>('/manage/projects', dto).then((r) => r.data.data),
  manageUpdate: (id: string, dto: UpdateProjectPayload) =>
    apiClient.patch<{ success: true; data: Project }>(`/manage/projects/${id}`, dto).then((r) => r.data.data),
  manageArchive: (id: string, archived: boolean) =>
    apiClient.patch<{ success: true; data: Project }>(`/manage/projects/${id}/${archived ? 'archive' : 'unarchive'}`),
  manageDelete: (id: string) =>
    apiClient.delete<{ success: true; data: { taskCount: number } }>(`/manage/projects/${id}`),
  manageRestore: (id: string) =>
    apiClient.patch<{ success: true; data: Project }>(`/manage/projects/${id}/restore`),

  manageMembers: (id: string) =>
    apiClient.get<{ success: true; data: ManagedMember[] }>(`/manage/projects/${id}/members`).then((r) => r.data.data),
  manageAddMember: (id: string, userId: string, role = 'member') =>
    apiClient.post<{ success: true; data: ManagedMember }>(`/manage/projects/${id}/members`, { userId, role }).then((r) => r.data.data),
  manageRemoveMember: (id: string, userId: string) =>
    apiClient.delete(`/manage/projects/${id}/members/${userId}`),
}
