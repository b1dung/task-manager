import { apiClient } from './client'
import type { TaskUser } from './tasks'

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: string
  joinedAt: string
  user: TaskUser
  taskCount: number
}

export const membersApi = {
  list: (projectId: string, params?: { role?: string; workload?: string; status?: string }) =>
    apiClient.get<{ success: true; data: ProjectMember[] }>(`/projects/${projectId}/members`, { params }).then((r) => r.data.data),
  add: (projectId: string, dto: { userId: string; role?: string }) =>
    apiClient.post<{ success: true; data: ProjectMember }>(`/projects/${projectId}/members`, dto).then((r) => r.data.data),
  updateRole: (projectId: string, userId: string, role: string) =>
    apiClient.patch<{ success: true; data: ProjectMember }>(`/projects/${projectId}/members/${userId}`, { role }).then((r) => r.data.data),
  remove: (projectId: string, userId: string) =>
    apiClient.delete(`/projects/${projectId}/members/${userId}`),
}
