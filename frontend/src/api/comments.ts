import { apiClient } from './client'
import type { TaskUser } from './tasks'

export interface Comment {
  id: string
  taskId: string
  authorId: string
  author: TaskUser
  content: string
  parentId: string | null
  editedAt: string | null
  createdAt: string
  replies?: Comment[]
}

export const commentsApi = {
  list: (projectId: string, taskId: string) =>
    apiClient.get<{ success: true; data: Comment[] }>(`/projects/${projectId}/tasks/${taskId}/comments`).then((r) => r.data.data),
  create: (projectId: string, taskId: string, dto: { content: string; parentId?: string }) =>
    apiClient.post<{ success: true; data: Comment }>(`/projects/${projectId}/tasks/${taskId}/comments`, dto).then((r) => r.data.data),
  update: (projectId: string, taskId: string, id: string, content: string) =>
    apiClient.patch<{ success: true; data: Comment }>(`/projects/${projectId}/tasks/${taskId}/comments/${id}`, { content }).then((r) => r.data.data),
  delete: (projectId: string, taskId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/tasks/${taskId}/comments/${id}`),
}
