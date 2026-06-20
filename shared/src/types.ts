import {
  ActivityAction,
  ActivityEntityType,
  NotificationType,
  SprintStatus,
  TaskLinkType,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserRole,
} from './enums'

export interface User {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  ownerId: string
  settingsJson: Record<string, unknown> | null
  createdAt: string
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: UserRole
  joinedAt: string
  user?: User
}

export interface BoardColumn {
  id: string
  projectId: string
  name: string
  position: number
  color: string | null
  wipLimit: number | null
  createdAt: string
}

export interface Label {
  id: string
  projectId: string
  name: string
  color: string
}

export interface Sprint {
  id: string
  projectId: string
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
}

export interface Task {
  id: string
  projectId: string
  columnId: string
  sprintId: string | null
  title: string
  description: string | null
  type: TaskType
  priority: TaskPriority
  status: TaskStatus
  assigneeId: string | null
  reporterId: string
  dueDate: string | null
  estimatedHours: number | null
  loggedHours: number | null
  storyPoints: number | null
  position: number
  parentTaskId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  assignee?: User | null
  reporter?: User
  labels?: Label[]
  commentCount?: number
  attachmentCount?: number
  subtaskCount?: number
}

export interface TaskLink {
  id: string
  sourceTaskId: string
  targetTaskId: string
  linkType: TaskLinkType
}

export interface Comment {
  id: string
  taskId: string
  authorId: string
  content: string
  parentId: string | null
  editedAt: string | null
  createdAt: string
  deletedAt: string | null
  author?: User
  replies?: Comment[]
}

export interface Attachment {
  id: string
  taskId: string
  uploaderId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  createdAt: string
}

export interface Notification {
  id: string
  recipientId: string
  actorId: string | null
  type: NotificationType
  entityType: string
  entityId: string
  message: string
  readAt: string | null
  createdAt: string
  actor?: User | null
}

export interface ActivityLog {
  id: string
  projectId: string
  userId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  user?: User
}

export interface WorkingHour {
  id: string
  taskId: string
  userId: string
  hours: number
  loggedDate: string
  note: string | null
  createdAt: string
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    [key: string]: unknown
  }
}

export interface ApiErrorResponse {
  success: false
  message: string
  errors?: string[]
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export interface PaginationQuery {
  page?: number
  limit?: number
  sort?: string
  order?: 'ASC' | 'DESC'
}
