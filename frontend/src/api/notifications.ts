import { apiClient } from './client'

export interface NotificationActor {
  id: string
  fullName: string
  avatarUrl: string | null
}

/** Resolved task/project for deep-linking — populated server-side. */
export interface NotificationContext {
  projectId: string | null
  projectName: string | null
  taskId: string | null
  taskNumber: number | null
  taskTitle: string | null
}

export interface Notification {
  id: string
  recipientId: string
  actorId: string | null
  actor?: NotificationActor | null
  type: string
  entityType: string
  entityId: string
  message: string
  readAt: string | null
  createdAt: string
  context?: NotificationContext | null
}

/** Build the deep-link to the task a notification refers to, or null if none. */
export function notificationLink(n: Notification): string | null {
  if (n.context?.projectId && n.context?.taskId) {
    return `/projects/${n.context.projectId}/tasks?selectedIssue=${n.context.taskId}`
  }
  return null
}

export const notificationsApi = {
  list: (params?: { unread?: boolean; page?: number }) =>
    apiClient.get<{ success: true; data: Notification[]; meta: object }>('/notifications', { params }).then((r) => r.data),
  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),
  unreadCount: () =>
    apiClient.get<{ success: true; data: { count: number } }>('/notifications/unread-count').then((r) => r.data.data),
}
