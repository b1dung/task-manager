import { apiClient } from './client'

export interface Label {
  id: string
  projectId: string
  name: string
  color: string
}

export const labelsApi = {
  list: (projectId: string) =>
    apiClient.get<{ success: true; data: Label[] }>(`/projects/${projectId}/labels`).then((r) => r.data.data),
  create: (projectId: string, dto: { name: string; color: string }) =>
    apiClient.post<{ success: true; data: Label }>(`/projects/${projectId}/labels`, dto).then((r) => r.data.data),
  update: (projectId: string, id: string, dto: { name?: string; color?: string }) =>
    apiClient.patch<{ success: true; data: Label }>(`/projects/${projectId}/labels/${id}`, dto).then((r) => r.data.data),
  delete: (projectId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/labels/${id}`),
}
