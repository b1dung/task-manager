import { apiClient } from './client'
import type { ActivityFilters } from '@/stores/useFilterStore'

export interface ActivityLog {
  id: string
  projectId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string
}

export const activityApi = {
  list: (projectId: string, filters?: ActivityFilters & { page?: number; limit?: number }) =>
    apiClient
      .get<{ success: true; data: ActivityLog[]; meta: object }>(`/projects/${projectId}/activity`, { params: filters })
      .then((r) => r.data),
  export: (projectId: string) =>
    apiClient.get(`/projects/${projectId}/activity/export`, { responseType: 'blob' }),
}
