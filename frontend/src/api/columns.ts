import { apiClient } from './client'

export interface BoardColumn {
  id: string
  projectId: string
  name: string
  position: number
  color: string | null
  wipLimit: number | null
}

export const columnsApi = {
  list: (projectId: string) =>
    apiClient.get<{ success: true; data: BoardColumn[] }>(`/projects/${projectId}/columns`).then((r) => r.data.data),
  create: (projectId: string, dto: { name: string; color?: string }) =>
    apiClient.post<{ success: true; data: BoardColumn }>(`/projects/${projectId}/columns`, dto).then((r) => r.data.data),
  update: (projectId: string, id: string, dto: { name?: string; color?: string; wipLimit?: number }) =>
    apiClient.patch<{ success: true; data: BoardColumn }>(`/projects/${projectId}/columns/${id}`, dto).then((r) => r.data.data),
  delete: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/columns/${id}`),
  reorder: (projectId: string, orderedIds: string[]) =>
    apiClient.patch(`/projects/${projectId}/columns/reorder`, { columnIds: orderedIds }),
}
