import { apiClient } from './client'

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

export interface ProjectAttachment {
  id: string
  taskId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  createdAt: string
  uploaderId: string
  uploader: { id: string; fullName: string; avatarUrl: string | null } | null
  task: { id: string; title: string; taskNumber: number | null }
}

export const attachmentsApi = {
  list: (projectId: string, taskId: string) =>
    apiClient.get<{ data: Attachment[] }>(`/projects/${projectId}/tasks/${taskId}/attachments`)
      .then(r => r.data.data),

  listForProject: (projectId: string) =>
    apiClient.get<{ data: ProjectAttachment[] }>(`/projects/${projectId}/attachments`)
      .then(r => r.data.data),

  upload: (projectId: string, taskId: string, file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<{ data: Attachment }>(
      `/projects/${projectId}/tasks/${taskId}/attachments`,
      form,
      {
        headers: { 'Content-Type': undefined },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      },
    ).then(r => r.data.data)
  },

  remove: (projectId: string, taskId: string, id: string) =>
    apiClient.delete(`/projects/${projectId}/tasks/${taskId}/attachments/${id}`),
}
