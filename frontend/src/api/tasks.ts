import { apiClient } from './client'
import type { BoardFilters } from '@/stores/useFilterStore'

export interface TaskUser {
  id: string
  fullName: string
  email: string
  avatarUrl: string | null
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface SubtaskPreview {
  id: string
  title: string
  status: string
  taskNumber: number | null
  assigneeId: string | null
  assignee: TaskUser | null
  parentTaskId: string | null
}

export interface Task {
  id: string
  projectId: string
  columnId: string
  sprintId: string | null
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  assigneeId: string | null
  reporterId: string
  assignee: TaskUser | null
  reporter: TaskUser
  dueDate: string | null
  estimatedHours: number | null
  loggedHours: number | null
  storyPoints: number | null
  position: number
  parentTaskId: string | null
  parentTask?: Task | null
  taskNumber?: number | null
  labels: Label[]
  subtasks?: Task[]
  subtaskCount?: number
  doneSubtaskCount?: number
  subtasksPreview?: SubtaskPreview[]
  createdAt: string
  updatedAt: string
}

export interface PaginatedTasks {
  data: Task[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface CreateTaskDto {
  columnId: string
  title: string
  description?: string
  type?: string
  priority?: string
  assigneeId?: string
  sprintId?: string
  dueDate?: string
  estimatedHours?: number
  storyPoints?: number
  labelIds?: string[]
  parentTaskId?: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  type?: string
  priority?: string
  status?: string
  columnId?: string
  assigneeId?: string | null
  sprintId?: string | null
  parentTaskId?: string | null
  dueDate?: string | null
  estimatedHours?: number
  loggedHours?: number
  storyPoints?: number
  labelIds?: string[]
}

export const tasksApi = {
  list: (projectId: string, filters?: BoardFilters & { page?: number; limit?: number; includeSubtasks?: boolean }) =>
    apiClient
      .get<PaginatedTasks & { success: true }>(`/projects/${projectId}/tasks`, { params: filters })
      .then((r) => r.data),
  get: (projectId: string, id: string) =>
    apiClient.get<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}`).then((r) => r.data.data),
  create: (projectId: string, dto: CreateTaskDto) =>
    apiClient.post<{ success: true; data: Task }>(`/projects/${projectId}/tasks`, dto).then((r) => r.data.data),
  update: (projectId: string, id: string, dto: UpdateTaskDto) =>
    apiClient.patch<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}`, dto).then((r) => r.data.data),
  delete: (projectId: string, id: string) => apiClient.delete(`/projects/${projectId}/tasks/${id}`),
  restore: (projectId: string, id: string) =>
    apiClient.patch<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}/restore`).then((r) => r.data.data),
  archive: (projectId: string, id: string) =>
    apiClient.patch<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}/archive`).then((r) => r.data.data),
  unarchive: (projectId: string, id: string) =>
    apiClient.patch<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}/unarchive`).then((r) => r.data.data),
  move: (projectId: string, id: string, dto: { columnId: string; position: number }) =>
    apiClient.patch<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}/move`, dto).then((r) => r.data.data),
  logTime: (projectId: string, id: string, dto: { hours: number; loggedDate?: string; description?: string }) =>
    apiClient.post<{ success: true; data: Task }>(`/projects/${projectId}/tasks/${id}/log-time`, dto).then((r) => r.data.data),
}
