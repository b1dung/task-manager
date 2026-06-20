import { apiClient } from './client'

export interface ArchivedUser {
  id: string
  fullName: string
  avatarUrl: string | null
}

export interface ArchivedTask {
  id: string
  taskNumber: number | null
  title: string
  type: string
  status: string
  assignee: ArchivedUser | null
  columnId: string | null
  columnName: string | null
  sprintId: string | null
  sprintName: string | null
  archivedAt: string | null
  archivedBy: ArchivedUser | null
}

export interface ArchivedProject {
  id: string
  name: string
  slug: string
  taskCount: number
  memberCount: number
  owner: ArchivedUser | null
  archivedAt: string | null
  archivedBy: ArchivedUser | null
}

export interface ArchivedData {
  tasks: ArchivedTask[]
  projects: ArchivedProject[]
}

export const archivedApi = {
  list: (projectId: string) =>
    apiClient
      .get<{ success: true; data: ArchivedData }>(`/projects/${projectId}/archived`)
      .then((r) => r.data.data),
}
