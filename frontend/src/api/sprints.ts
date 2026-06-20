import { apiClient } from './client'

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: string
}

export const sprintsApi = {
  list: (projectId: string) =>
    apiClient.get<{ success: true; data: Sprint[] }>(`/projects/${projectId}/sprints`).then((r) => r.data.data),
  create: (projectId: string, dto: { name: string; goal?: string; startDate?: string; endDate?: string }) =>
    apiClient.post<{ success: true; data: Sprint }>(`/projects/${projectId}/sprints`, dto).then((r) => r.data.data),
  update: (projectId: string, id: string, dto: Partial<Sprint>) =>
    apiClient.patch<{ success: true; data: Sprint }>(`/projects/${projectId}/sprints/${id}`, dto).then((r) => r.data.data),
  start: (projectId: string, id: string) =>
    apiClient.patch(`/projects/${projectId}/sprints/${id}/start`),
  complete: (projectId: string, id: string) =>
    apiClient.patch(`/projects/${projectId}/sprints/${id}/complete`),
}
