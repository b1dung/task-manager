export const SocketEvents = {
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_MOVED: 'task:moved',
  TASK_DELETED: 'task:deleted',
  COMMENT_ADDED: 'comment:added',
  NOTIFICATION_NEW: 'notification:new',
} as const

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents]

export interface TaskMovedPayload {
  taskId: string
  projectId: string
  fromColumnId: string
  toColumnId: string
  position: number
}
