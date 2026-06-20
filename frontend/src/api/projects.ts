import { apiClient } from './client'

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  createdAt: string
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
}
