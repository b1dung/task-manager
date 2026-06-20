import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Download, Trash2, FileText, FileArchive, Film, Music,
  File as FileIcon, Paperclip, ExternalLink,
} from 'lucide-react'
import { attachmentsApi, type ProjectAttachment } from '@/api/attachments'
import { projectsApi } from '@/api/projects'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar, EmptyState, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { formatRelative, cn } from '@/lib/utils'

type Filter = 'all' | 'image' | 'document' | 'other'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'other', label: 'Other' },
]

const DOC_TYPES = ['pdf', 'word', 'excel', 'spreadsheet', 'presentation', 'text', 'csv', 'document', 'msword', 'officedocument']

function getProjectKey(name?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return words.length > 1
    ? words.map((w) => w[0]).join('').toUpperCase()
    : (words[0] ?? 'TASK').slice(0, 5).toUpperCase()
}

function categoryOf(mime: string): Filter {
  if (mime.startsWith('image/')) return 'image'
  if (DOC_TYPES.some((t) => mime.includes(t))) return 'document'
  return 'other'
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function FileTypeIcon({ mime }: { mime: string }) {
  const cls = 'w-8 h-8'
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) return <FileArchive className={cls} />
  if (mime.startsWith('video/')) return <Film className={cls} />
  if (mime.startsWith('audio/')) return <Music className={cls} />
  if (categoryOf(mime) === 'document') return <FileText className={cls} />
  return <FileIcon className={cls} />
}

export function AttachmentsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
  })
  const projectKey = project ? getProjectKey(project.name) : 'TASK'

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', projectId],
    queryFn: () => attachmentsApi.listForProject(projectId),
    enabled: !!projectId,
  })

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (a: ProjectAttachment) => attachmentsApi.remove(projectId, a.taskId, a.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attachments', projectId] })
      toast.success('Đã xóa file')
    },
    onError: () => toast.error('Xóa file thất bại (chỉ xóa được file của bạn)'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attachments.filter((a) => {
      if (filter !== 'all' && categoryOf(a.mimeType) !== filter) return false
      if (q && !a.fileName.toLowerCase().includes(q) &&
          !a.task.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [attachments, search, filter])

  const counts = useMemo(() => ({
    total: attachments.length,
    size: attachments.reduce((s, a) => s + a.fileSize, 0),
  }), [attachments])

  const download = async (a: ProjectAttachment) => {
    try {
      const blob = await attachmentsApi.download(projectId, a.taskId, a.id)
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = a.fileName.normalize('NFC'); el.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Tải file thất bại')
    }
  }

  const openTask = (taskId: string) =>
    navigate(`/projects/${projectId}/tasks?selectedIssue=${taskId}`)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">Attachments</h1>
          <p className="text-xs text-fg-muted mt-0.5">
            Tất cả file đính kèm trong mô tả task của project.
            {!isLoading && ` ${counts.total} file · ${formatBytes(counts.size)}`}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên file hoặc task..."
            className="h-8 w-64 rounded-lg border border-border bg-bg-elevated pl-8 pr-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.value ? 'bg-accent text-white' : 'text-fg-muted hover:bg-bg-subtle',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-56 rounded-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<Paperclip className="w-12 h-12" />}
              title={attachments.length === 0 ? 'Chưa có file đính kèm' : 'Không tìm thấy file phù hợp'}
              description={attachments.length === 0 ? 'File upload trong mô tả task sẽ hiển thị ở đây.' : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((a) => {
              const canDelete = a.uploaderId === currentUserId
              return (
                <div
                  key={a.id}
                  className="group flex flex-col rounded-card border border-border bg-bg-elevated overflow-hidden transition-colors hover:border-accent/50"
                >
                  {/* Preview */}
                  <button
                    type="button"
                    onClick={() => download(a)}
                    className="relative flex items-center justify-center h-32 bg-bg-subtle overflow-hidden"
                    title="Mở file"
                  >
                    <span className="text-fg-subtle"><FileTypeIcon mime={a.mimeType} /></span>
                    <span className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-black/50 p-1 text-white">
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </button>

                  {/* Body */}
                  <div className="flex flex-col gap-1.5 p-3 flex-1">
                    <p className="text-xs font-medium text-fg truncate" title={a.fileName.normalize('NFC')}>{a.fileName.normalize('NFC')}</p>
                    <p className="text-[11px] text-fg-subtle">{formatBytes(a.fileSize)} · {formatRelative(a.createdAt)}</p>

                    <button
                      onClick={() => openTask(a.taskId)}
                      className="self-start text-[11px] font-mono text-accent hover:underline truncate max-w-full"
                      title={a.task.title}
                    >
                      {projectKey}-{a.task.taskNumber} · {a.task.title}
                    </button>

                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                      {a.uploader && (
                        <Avatar name={a.uploader.fullName} avatarUrl={a.uploader.avatarUrl} size="xs" />
                      )}
                      <span className="text-[11px] text-fg-subtle truncate flex-1">
                        {a.uploader?.fullName ?? 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => download(a)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-fg-muted hover:bg-bg-subtle hover:text-fg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Tải
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => remove(a)}
                        disabled={removing}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs text-fg-muted hover:bg-danger/10 hover:text-danger transition-colors border-l border-border disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
