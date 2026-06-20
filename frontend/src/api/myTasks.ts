import { apiClient } from './client'
import type { Task } from './tasks'

export interface MyTask extends Task {
  project?: { id: string; name: string; slug: string } | null
}

export interface MyTaskStats {
  total: number
  dueToday: number
  overdue: number
  completed: number
  inProgress: number
}

export interface MyTasksParams {
  scope?: 'assigned' | 'reported'
  q?: string
  status?: string
  priority?: string
  projectId?: string
}

export const myTasksApi = {
  list: (params?: MyTasksParams) =>
    apiClient
      .get<{ success: true; data: { items: MyTask[]; stats: MyTaskStats } }>('/me/tasks', { params })
      .then((r) => r.data.data),
}
