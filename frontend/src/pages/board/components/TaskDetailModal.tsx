import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, ExternalLink, MoreHorizontal, Eye, Share2, Lock,
  Plus, ChevronDown, ChevronRight, Bold, List, Code2,
  Link2, Check, Calendar, Flag, User, Tag,
  Zap, GitBranch, AlignLeft, CheckSquare, Trash2, Pencil,
  Italic, Underline as UnderlineIcon, Strikethrough, ListOrdered,
  Quote, FileCode, Image as ImageIcon, Highlighter,
  AlignCenter, AlignRight, Undo, Redo,
  Paperclip, Download, FileText,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapUnderline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TiptapImage from '@tiptap/extension-image'
import TiptapLink from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { tasksApi, type Task, type UpdateTaskDto } from '@/api/tasks'
import { commentsApi, type Comment } from '@/api/comments'
import { membersApi } from '@/api/members'
import { labelsApi } from '@/api/labels'
import { attachmentsApi } from '@/api/attachments'
import { apiClient } from '@/api/client'
import { Avatar, Button, Dropdown, Skeleton } from '@/components/ui'
import { TaskIcon, SubtaskIcon } from '@/components/ui/TaskIcons'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useToast } from '@/hooks/useToast'
import { cn, formatDate, formatRelative } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskLink {
  id: string
  sourceTaskId: string
  targetTaskId: string
  linkType: 'blocks' | 'blocked_by' | 'relates_to'
  sourceTask: Task
  targetTask: Task
}

type TabType = 'all' | 'comments' | 'history' | 'worklog'

const LINK_TYPE_LABELS: Record<string, string> = {
  blocks: 'blocks',
  blocked_by: 'is blocked by',
  relates_to: 'relates to',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; hexBg: string; hexColor: string }> = {
  todo:        { label: 'To Do',       color: 'text-fg-muted',  bg: 'bg-bg-subtle',   hexBg: '#F4F5F7', hexColor: '#42526E' },
  in_progress: { label: 'In Progress', color: 'text-info',      bg: 'bg-info/10',     hexBg: '#0052CC', hexColor: '#FFFFFF' },
  in_review:   { label: 'In Review',   color: 'text-warning',   bg: 'bg-warning/10',  hexBg: '#6554C0', hexColor: '#FFFFFF' },
  done:        { label: 'Done',        color: 'text-success',   bg: 'bg-success/10',  hexBg: '#00875A', hexColor: '#FFFFFF' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; svg: string; hexColor: string }> = {
  urgent: { label: 'Urgent', color: 'text-danger',   svg: '/priority/highest_new.svg', hexColor: '#F15B50' },
  high:   { label: 'High',   color: 'text-warning',  svg: '/priority/high_new.svg',    hexColor: '#F15B50' },
  medium: { label: 'Medium', color: 'text-info',     svg: '/priority/medium_new.svg',  hexColor: '#E06C00' },
  low:    { label: 'Low',    color: 'text-fg-muted', svg: '/priority/low_new.svg',     hexColor: '#4688EC' },
  lowest: { label: 'Lowest', color: 'text-fg-subtle',svg: '/priority/lowest_new.svg',  hexColor: '#8899BB' },
}

const DEFAULT_AVATAR = 'https://jira.mintoku.vn/assets/images/default-avatar.jpg'

const SUBTASK_STATUS: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'To Do',       cls: 'text-fg-muted bg-bg-subtle border-border' },
  in_progress: { label: 'In Progress', cls: 'text-info bg-info/10 border-info/30' },
  in_review:   { label: 'In Review',   cls: 'text-warning bg-warning/10 border-warning/30' },
  done:        { label: 'Done',        cls: 'text-success bg-success/10 border-success/30' },
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

// 1w=5d, 1d=8h — same convention as Jira
function parseTimeInput(input: string): number {
  const re = /(\d+(?:\.\d+)?)\s*(w|d|h|m)\b/gi
  let hours = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    const v = parseFloat(m[1])
    switch (m[2].toLowerCase()) {
      case 'w': hours += v * 40; break
      case 'd': hours += v * 8; break
      case 'h': hours += v; break
      case 'm': hours += v / 60; break
    }
  }
  return hours
}

function formatTimeHours(totalHours: number): string {
  if (!totalHours || totalHours < 0) return '0h'
  const totalMins = Math.round(totalHours * 60)
  const w = Math.floor(totalMins / (40 * 60))
  const d = Math.floor((totalMins % (40 * 60)) / (8 * 60))
  const h = Math.floor((totalMins % (8 * 60)) / 60)
  const m = totalMins % 60
  const parts: string[] = []
  if (w) parts.push(`${w}w`)
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  return parts.length ? parts.join(' ') : '0h'
}

// ─── Main Modal ───────────────────────────────────────────────────────────────


interface Props {
  task: Task | null
  taskId?: string | null
  projectId: string
  projectKey?: string
  open: boolean
  onClose: () => void
  onOpenTask?: (taskId: string) => void
}

export function TaskDetailModal({ task, taskId, projectId, projectKey = 'TASK', open, onClose, onOpenTask }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<TabType>('comments')

  const targetId = task?.id ?? taskId

  // Store side-effect: update store on success so TaskCard re-renders instantly
  const updateTaskInStore = useTaskStore((s) => s.updateTask)

  // freshTask is the authoritative source (has subtasks, parentTask relations from findById)
  // staleTime=0 ensures we always get fresh data including subtasks on every open
  const { data: freshTask, isLoading: isFetchingTask } = useQuery({
    queryKey: ['task', projectId, targetId],
    queryFn: () => tasksApi.get(projectId, targetId!),
    enabled: open && !!targetId,
    staleTime: 0,
  })
  // freshTask is primary (has full relations); fall back to prop for immediate display
  const t = freshTask ?? task

  const { mutate: updateTask } = useMutation({
    mutationFn: (dto: UpdateTaskDto) => tasksApi.update(projectId, t!.id, dto),
    onMutate: (dto) => {
      if (t) {
        // For assigneeId changes, look up full assignee object from cached members
        let enriched: Partial<Task> = dto
        if ('assigneeId' in dto) {
          type M = { userId: string; user: { id: string; fullName: string; email: string; avatarUrl: string | null } }
          const cachedMembers = qc.getQueryData<M[]>(['members', projectId]) ?? []
          const memberUser = cachedMembers.find((m) => m.userId === dto.assigneeId)?.user ?? null
          enriched = { ...dto, assignee: memberUser }
        }
        // Update query cache for immediate display in modal
        qc.setQueryData(['task', projectId, t.id], { ...t, ...enriched })
        // Update store so TaskCard re-renders optimistically
        updateTaskInStore(t.id, enriched)
      }
    },
    onSuccess: (updated) => {
      // Confirm with full server response (has assignee object, subtasks, etc.)
      updateTaskInStore(updated.id, updated)
      qc.setQueryData(['task', projectId, updated.id], updated)
      qc.setQueriesData(
        { queryKey: ['tasks', projectId] },
        (old: { data: Task[]; meta: unknown } | undefined) => {
          if (!old) return old
          return { ...old, data: old.data.map((tk) => (tk.id === updated.id ? updated : tk)) }
        },
      )
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: () => {
      // Rollback: re-fetch fresh server state
      qc.invalidateQueries({ queryKey: ['task', projectId, t?.id] })
      toast.error('Cập nhật thất bại')
    },
  })

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const taskDisplayId = t?.taskNumber != null
    ? `${projectKey}-${t.taskNumber}`
    : t ? `${projectKey}-${(t.position ?? 0) + 1}` : '…'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel — responsive sizing per spec */}
      <div
        data-testid="task-detail-modal"
        className={cn(
          'relative flex flex-col border border-border bg-bg-surface shadow-app-lg overflow-hidden animate-modal-enter',
          // mobile/tablet: full screen
          'w-screen h-screen rounded-none',
          // ≥1024px: 92vw × 88vh
          'lg:w-[92vw] lg:h-[88vh] lg:rounded-lg',
          // ≥1280px: min(1200px,90vw) × min(860px,90vh)
          'xl:w-[min(1200px,90vw)] xl:h-[min(860px,90vh)] xl:max-w-modal-fhd',
          // ≥1536px (2K+): min(1400px,88vw) × min(920px,88vh)
          '2xl:w-[min(1400px,88vw)] 2xl:h-[min(920px,88vh)] 2xl:max-w-modal-2k',
        )}
      >
        {/* Header — 56px height, 24px horizontal padding */}
        <DetailHeader
          displayId={taskDisplayId}
          parentTask={t?.parentTask ?? null}
          projectKey={projectKey}
          onClose={onClose}
          onOpenParent={onOpenTask}
        />

        {/* Loading overlay while fetching subtask */}
        {isFetchingTask && !t && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-fg-muted">
              <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          </div>
        )}

        {/* Body: left + right — only when task data available */}
        {t && <div className="flex flex-1 min-h-0">
          {/* Left column — scrollable, 40px horizontal / 32px vertical padding */}
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin px-10 py-8 space-y-5">
            {/* Title */}
            <TitleEditor task={t} onSave={(title) => updateTask({ title })} />

            {/* Action buttons under title */}
            <div className="flex items-center gap-1.5 -mt-2">
              <button
                title="Add child task"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-fg-muted border border-border hover:border-accent/50 hover:text-accent transition-colors"
              >
                <Plus className="w-3 h-3" /> Child
              </button>
              <button
                title="More options"
                className="flex items-center gap-1 px-2 h-[27px] rounded-md text-xs text-fg-muted border border-border hover:border-accent/50 hover:text-fg transition-colors"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>

            {/* Description */}
            <DescriptionEditor task={t} onSave={(description) => updateTask({ description })} />

            {/* Subtasks */}
            <SubtasksSection task={t} projectId={projectId} projectKey={projectKey} onSubtaskClick={onOpenTask} />

            {/* Linked items */}
            <LinkedItemsSection task={t} projectId={projectId} />

            {/* Attachments */}
            <AttachmentsSection task={t} projectId={projectId} />

            {/* Activity tabs */}
            <div>
              <div className="flex gap-1 border-b border-border mb-4">
                {(['all', 'comments', 'history', 'worklog'] as TabType[]).map((id) => {
                  const labels = { all: 'All', comments: 'Comments', history: 'History', worklog: 'Work Log' }
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cn(
                        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === id ? 'border-accent text-accent' : 'border-transparent text-fg-muted hover:text-fg'
                      )}
                    >
                      {labels[id]}
                    </button>
                  )
                })}
              </div>

              {tab === 'all'      && <AllTab projectId={projectId} taskId={t.id} />}
              {tab === 'comments' && <CommentsTab projectId={projectId} taskId={t.id} />}
              {tab === 'history'  && <HistoryTab projectId={projectId} taskId={t.id} />}
              {tab === 'worklog'  && <WorkLogTab task={t} onUpdate={updateTask} />}
            </div>
          </div>

          {/* Right column — sticky */}
          <RightColumn
            task={t}
            projectId={projectId}
            projectKey={projectKey}
            onUpdate={updateTask}
          />
        </div>}
      </div>
    </div>
  )
}

// ─── Detail Header ────────────────────────────────────────────────────────────

function DetailHeader({ displayId, parentTask, projectKey = 'TASK', onClose, onOpenParent }: {
  displayId: string
  parentTask: Task | null | undefined
  projectKey?: string
  onClose: () => void
  onOpenParent?: (taskId: string) => void
}) {
  const toast = useToast()

  const copyId = () => {
    navigator.clipboard.writeText(displayId)
    toast.success('Đã copy task ID')
  }

  const parentDisplayId = parentTask?.taskNumber != null
    ? `${projectKey}-${parentTask.taskNumber}`
    : parentTask ? `${projectKey}-${(parentTask.position ?? 0) + 1}` : null

  return (
    <div className="flex items-center gap-2 h-14 px-6 border-b border-border shrink-0 bg-bg-surface">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-fg-muted overflow-hidden">
        {parentTask ? (
          <>
            <button
              onClick={() => onOpenParent?.(parentTask.id)}
              title={`Mở ${parentDisplayId} — ${parentTask.title}`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-subtle border border-border hover:border-accent/50 hover:text-accent transition-colors font-mono shrink-0"
            >
              <CheckSquare className="w-3 h-3" />
              <span className="max-w-[120px] truncate">{parentDisplayId} {parentTask.title}</span>
            </button>
            <span className="shrink-0">/</span>
          </>
        ) : (
          <>
            <button className="hover:text-accent transition-colors flex items-center gap-1 shrink-0">
              <Plus className="w-3 h-3" /> Add epic
            </button>
            <span className="shrink-0">/</span>
          </>
        )}
        <button
          onClick={copyId}
          title="Copy task ID"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-subtle border border-border hover:border-accent/50 hover:text-fg transition-colors font-mono shrink-0"
        >
          <TaskIcon size={12} />
          {displayId}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button
          title="Watch"
          className="h-7 w-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          title="Share"
          className="h-7 w-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
          onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link đã copy') }}
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        <Dropdown
          trigger={
            <button className="h-7 w-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          }
          align="right"
          items={[
            { label: 'Copy link', icon: <Link2 className="w-4 h-4" />, onClick: () => navigator.clipboard.writeText(window.location.href) },
            { label: 'Duplicate', icon: <AlignLeft className="w-4 h-4" />, onClick: () => toast.info('Duplicate chưa hỗ trợ') },
            { label: 'Archive', icon: <Lock className="w-4 h-4" />, onClick: () => toast.info('Archive chưa hỗ trợ') },
            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => toast.info('Dùng nút Delete trong board'), danger: true },
          ]}
        />

        <button
          title="Open full page"
          className="h-7 w-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>

        <button
          title="Đóng"
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Title Editor ─────────────────────────────────────────────────────────────

function TitleEditor({ task, onSave }: { task: Task; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.title)

  const commit = () => {
    setEditing(false)
    if (value.trim() && value !== task.title) onSave(value.trim())
    else setValue(task.title)
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setValue(task.title); setEditing(false) }
        }}
        rows={2}
        className="w-full bg-transparent border-b-2 border-accent text-2xl font-bold text-fg resize-none focus:outline-none leading-tight pb-1"
      />
    )
  }

  return (
    <h1
      className="text-2xl font-bold text-fg leading-tight cursor-pointer hover:text-accent/90 transition-colors"
      onClick={() => { setEditing(true); setValue(task.title) }}
    >
      {task.title}
    </h1>
  )
}

// ─── Description Editor ───────────────────────────────────────────────────────

function EditorToolbarBtn({ children, title, onClick, active = false, disabled = false }: {
  children: React.ReactNode; title: string; onClick: () => void; active?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      className={cn(
        'h-6 w-6 flex items-center justify-center rounded transition-colors text-sm',
        active ? 'bg-accent/20 text-accent' : 'text-fg-muted hover:text-fg hover:bg-bg-elevated',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function EditorToolbarSep() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
}

function DescriptionEditor({ task, onSave }: { task: Task; onSave: (d: string) => void }) {
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<number, number>>({})
  const toast = useToast()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapUnderline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TiptapImage.configure({ allowBase64: false, inline: false }),
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Thêm mô tả cho task…' }),
      Highlight,
    ],
    content: task.description ?? '',
    onUpdate: () => setDirty(true),
  })

  // Reset when switching to a different task
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(task.description ?? '')
      setDirty(false)
    }
    setPending([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  const save = async () => {
    if (!editor) return
    if (pending.length > 0) {
      setUploading(true)
      setProgress({})
      const count = pending.length
      try {
        for (let i = 0; i < pending.length; i++) {
          await attachmentsApi.upload(task.projectId, task.id, pending[i], (p) =>
            setProgress((prev) => ({ ...prev, [i]: p })),
          )
        }
        await qc.invalidateQueries({ queryKey: ['task-attachments', task.projectId, task.id] })
        setPending([])
        setProgress({})
        toast.success(`Đã thêm ${count} file đính kèm`)
      } catch {
        toast.error('Upload file thất bại')
      } finally {
        setUploading(false)
      }
    }
    if (dirty) onSave(editor.getHTML())
    setDirty(false)
  }
  const cancel = () => {
    if (!editor) return
    editor.commands.setContent(task.description ?? '')
    setDirty(false)
    setPending([])
    setProgress({})
  }

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (attachInputRef.current) attachInputRef.current.value = ''
    if (files.length) setPending((prev) => [...prev, ...files])
  }

  const setLink = () => {
    const prev = editor?.getAttributes('link').href ?? ''
    const url = window.prompt('URL:', prev)
    if (url === null) return
    if (!url) {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''
    try {
      const att = await attachmentsApi.upload(task.projectId, task.id, file)
      editor?.chain().focus().setImage({ src: att.fileUrl }).run()
    } catch {
      toast.error('Upload ảnh thất bại')
    }
  }

  if (!editor) return null

  return (
    <div>
      <p className="text-sm font-semibold text-fg mb-2">Description</p>

      <div className="rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-accent transition-shadow">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg-subtle">
          <EditorToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
            <Bold className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
            <Italic className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
            <UnderlineIcon className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
            <Strikethrough className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
            <span className="text-[10px] font-bold leading-none">H1</span>
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
            <span className="text-[10px] font-bold leading-none">H2</span>
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            <List className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            <ListOrdered className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
            <Quote className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}>
            <Code2 className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
            <FileCode className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Link" onClick={setLink} active={editor.isActive('link')}>
            <Link2 className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Insert image" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Attach file" onClick={() => attachInputRef.current?.click()}>
            <Paperclip className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')}>
            <Highlighter className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarSep />

          <EditorToolbarBtn title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
            <AlignLeft className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
            <AlignCenter className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
          <EditorToolbarBtn title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
            <AlignRight className="w-3.5 h-3.5" />
          </EditorToolbarBtn>
        </div>

        {/* Editor area */}
        <EditorContent
          editor={editor}
          className="min-h-[120px] px-3 py-2.5 text-sm text-fg bg-bg-elevated cursor-text"
        />
      </div>

      {/* Pending files to attach on save */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {pending.map((f, i) => {
            const pct = progress[i]
            const active = uploading && pct !== undefined
            return (
              <div key={i} className="rounded-md border border-border bg-bg-subtle px-2 py-1.5 text-xs text-fg">
                <div className="flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3 shrink-0 text-fg-subtle" />
                  <span className="flex-1 truncate">{f.name.normalize('NFC')}</span>
                  <span className="shrink-0 text-[11px] text-fg-subtle">{formatBytes(f.size)}</span>
                  {uploading ? (
                    <span className="shrink-0 w-9 text-right text-[11px] font-medium text-accent">{pct ?? 0}%</span>
                  ) : (
                    <button
                      onClick={() => setPending((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-fg-subtle hover:text-danger"
                      title="Bỏ file"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {uploading && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-bg overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full bg-accent transition-all duration-200',
                        active && pct === 100 && 'bg-success',
                      )}
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(dirty || pending.length > 0) && (
        <div className="flex gap-2 mt-1.5">
          <Button variant="primary" size="sm" onClick={save} loading={uploading}>Save</Button>
          <Button variant="ghost" size="sm" onClick={cancel} disabled={uploading}>Cancel</Button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      <input ref={attachInputRef} type="file" multiple className="hidden" onChange={handleAttachFiles} />
    </div>
  )
}

// ─── Attachments Section ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function AttachmentsSection({ task, projectId }: { task: Task; projectId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data: attachments = [] } = useQuery({
    queryKey: ['task-attachments', projectId, task.id],
    queryFn: () => attachmentsApi.list(projectId, task.id),
    enabled: !!projectId && !!task.id,
  })

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (id: string) => attachmentsApi.remove(projectId, task.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', projectId, task.id] })
      toast.success('Đã xóa file')
    },
    onError: () => toast.error('Xóa file thất bại (chỉ xóa được file của bạn)'),
  })

  const download = async (fileUrl: string, fileName: string) => {
    try {
      const res = await fetch(fileUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = fileName.normalize('NFC'); el.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Tải file thất bại')
    }
  }

  if (attachments.length === 0) return null

  return (
    <div>
      <p className="text-sm font-semibold text-fg mb-2">
        Attachments <span className="text-fg-subtle font-normal">({attachments.length})</span>
      </p>
      <div className="space-y-1.5">
        {attachments.map((a) => {
          const isImage = a.mimeType.startsWith('image/')
          const canDelete = a.uploaderId === currentUserId
          return (
            <div
              key={a.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-bg-surface px-3 py-2 hover:bg-bg-subtle transition-colors"
            >
              {/* Thumbnail / icon */}
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-bg-subtle text-fg-subtle"
                title="Mở file"
              >
                {isImage
                  ? <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" loading="lazy" />
                  : <FileText className="h-4 w-4" />}
              </a>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-fg" title={a.fileName.normalize('NFC')}>{a.fileName.normalize('NFC')}</p>
                <p className="text-[11px] text-fg-subtle">{formatBytes(a.fileSize)} · {formatRelative(a.createdAt)}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => download(a.fileUrl, a.fileName)}
                  className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-elevated hover:text-fg transition-colors"
                  title="Tải về"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {canDelete && (
                  <button
                    onClick={() => remove(a.id)}
                    disabled={removing}
                    className="rounded-md p-1.5 text-fg-subtle hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
                    title="Xóa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Subtask Status Picker ────────────────────────────────────────────────────

function SubtaskStatusPicker({ sub, projectId, onUpdate }: {
  sub: Task; projectId: string; onUpdate: () => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const cfg = SUBTASK_STATUS[sub.status] ?? SUBTASK_STATUS.todo

  const openDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right })
    }
    setOpen(v => !v)
  }

  const updateStatus = async (status: string) => {
    await tasksApi.update(projectId, sub.id, { status })
    onUpdate()
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={openDropdown}
        className={cn(
          'w-full inline-flex items-center justify-between gap-0.5 h-[25px] px-1.5 py-0.5 rounded-[4px] border text-[11px] font-medium transition-colors',
          cfg.cls,
        )}
      >
        <span className="truncate">{cfg.label}</span>
        <ChevronDown className="w-2.5 h-2.5 shrink-0" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-36 rounded-lg border border-border bg-bg-surface shadow-app-md overflow-hidden"
            style={{ top: pos.top, left: pos.left - 144 }}
          >
            {Object.entries(SUBTASK_STATUS).map(([key, sc]) => (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); updateStatus(key) }}
                className={cn(
                  'w-full flex items-center px-3 py-1.5 text-xs hover:bg-bg-subtle transition-colors',
                  key === sub.status && 'bg-bg-subtle',
                )}
              >
                <span className={cn('inline-flex px-1.5 py-0.5 rounded-[4px] border text-[10px] font-medium', sc.cls)}>
                  {sc.label}
                </span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// ─── Subtasks Section ─────────────────────────────────────────────────────────

function SubtasksSection({ task, projectId, projectKey = 'TASK', onSubtaskClick }: {
  task: Task; projectId: string; projectKey?: string; onSubtaskClick?: (taskId: string) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const subtasks = (task.subtasks ?? [])
  const done = subtasks.filter((s) => s.status === 'done').length
  const pct = subtasks.length ? Math.round((done / subtasks.length) * 100) : 0

  const { mutate: createSubtask, isPending } = useMutation({
    mutationFn: () => tasksApi.create(projectId, {
      columnId: task.columnId,
      title: newTitle.trim(),
      parentTaskId: task.id,
    }),
    onMutate: () => {
      // Optimistically bump subtask_count on parent card in the board list
      qc.setQueriesData(
        { queryKey: ['tasks', projectId] },
        (old: { data: Task[]; meta: unknown } | undefined) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.map((t) =>
              t.id === task.id ? { ...t, subtaskCount: (t.subtaskCount ?? 0) + 1 } : t,
            ),
          }
        },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', projectId, task.id] })
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      setNewTitle('')
      setAdding(false)
    },
    onError: () => {
      toast.error('Tạo subtask thất bại')
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-fg">Subtasks</p>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add subtask
        </button>
      </div>

      {subtasks.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
            <span>{done} / {subtasks.length} completed</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-subtle overflow-hidden">
            <div
              className="h-full rounded-full bg-success transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {subtasks.map((sub) => {
          const pri = PRIORITY_CONFIG[sub.priority] ?? PRIORITY_CONFIG.medium
          const taskCode = sub.taskNumber != null ? `${projectKey}-${sub.taskNumber}` : null
          return (
            <div
              key={sub.id}
              className="flex items-center gap-2 py-2 px-2.5 rounded-lg border border-border/50 bg-bg-surface hover:bg-bg-subtle transition-colors group"
            >
              {/* Subtask icon — 14px fixed */}
              <SubtaskIcon size={14} />

              {/* Task code + title — takes remaining space */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {taskCode && (
                  <button
                    onClick={() => onSubtaskClick?.(sub.id)}
                    className="text-[11px] font-bold text-info shrink-0 hover:underline"
                  >
                    {taskCode}
                  </button>
                )}
                <span
                  className={cn(
                    'text-sm text-fg truncate',
                    sub.status === 'done' && 'line-through text-fg-subtle',
                    onSubtaskClick && 'cursor-pointer hover:text-accent transition-colors',
                  )}
                  onClick={() => onSubtaskClick?.(sub.id)}
                >
                  {sub.title}
                </span>
              </div>

              {/* Priority — 76px fixed */}
              <div className="w-[76px] shrink-0 flex items-center gap-1">
                <img src={pri.svg} alt={pri.label} width={14} height={14} className="shrink-0" />
                <span className="text-[12px] truncate" style={{ color: pri.hexColor }}>{pri.label}</span>
              </div>

              {/* Assignee — 108px fixed */}
              <div className="w-[108px] shrink-0 flex items-center gap-1">
                {sub.assignee ? (
                  <>
                    <Avatar name={sub.assignee.fullName} avatarUrl={sub.assignee.avatarUrl} size="xs" className="shrink-0" />
                    <span className="text-[12px] text-fg-muted truncate">{sub.assignee.fullName}</span>
                  </>
                ) : (
                  <>
                    <img src={DEFAULT_AVATAR} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                    <span className="text-[12px] text-fg-muted">Unassigned</span>
                  </>
                )}
              </div>

              {/* Status dropdown — 90px fixed */}
              <div className="w-[90px] shrink-0">
                <SubtaskStatusPicker
                  sub={sub}
                  projectId={projectId}
                  onUpdate={() => qc.invalidateQueries({ queryKey: ['task', projectId, task.id] })}
                />
              </div>
            </div>
          )
        })}
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTitle.trim()) createSubtask()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder="Tên subtask..."
            className="flex-1 h-8 rounded-lg border border-border bg-bg-elevated px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-subtle"
          />
          <Button variant="primary" size="sm" onClick={() => newTitle.trim() && createSubtask()} loading={isPending}>Add</Button>
          <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewTitle('') }}>✕</Button>
        </div>
      )}
    </div>
  )
}

// ─── Linked Items Section ─────────────────────────────────────────────────────

function LinkedItemsSection({ task, projectId }: { task: Task; projectId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [linkType, setLinkType] = useState<'blocks' | 'blocked_by' | 'relates_to'>('relates_to')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const { data: links = [] } = useQuery<TaskLink[]>({
    queryKey: ['task-links', projectId, task.id],
    queryFn: () => apiClient.get<{ success: true; data: TaskLink[] }>(`/projects/${projectId}/tasks/${task.id}/links`).then(r => r.data.data),
  })

  const { data: allTasks } = useQuery({
    queryKey: ['tasks-search', projectId],
    queryFn: () => tasksApi.list(projectId, { limit: 200 }),
    enabled: adding,
    select: (d) => d.data.filter((t) => t.id !== task.id),
  })

  const { mutate: addLink, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/projects/${projectId}/tasks/${task.id}/links`, { targetTaskId: selectedId, linkType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-links', projectId, task.id] })
      setAdding(false); setSearch(''); setSelectedId('')
      toast.success('Đã liên kết task')
    },
    onError: () => toast.error('Liên kết thất bại'),
  })

  const { mutate: removeLink } = useMutation({
    mutationFn: (linkId: string) => apiClient.delete(`/projects/${projectId}/tasks/${task.id}/links/${linkId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-links', projectId, task.id] }),
    onError: () => toast.error('Xóa liên kết thất bại'),
  })

  const filtered = (allTasks ?? []).filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-fg">Linked work items</p>
        <button onClick={() => setAdding(true)} className="text-xs text-accent hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add linked work item
        </button>
      </div>

      {links.map((link) => {
        const other = link.sourceTaskId === task.id ? link.targetTask : link.sourceTask
        const sconf = STATUS_CONFIG[other?.status ?? 'todo']
        return (
          <div key={link.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-subtle group">
            <span className="text-xs text-fg-subtle italic w-24 shrink-0">{LINK_TYPE_LABELS[link.linkType]}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', sconf.color, sconf.bg)}>
              {sconf.label}
            </span>
            <span className="text-sm text-fg flex-1 truncate">{other?.title ?? '—'}</span>
            <button
              onClick={() => removeLink(link.id)}
              className="opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-danger transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}

      {adding && (
        <div className="mt-2 p-3 rounded-lg border border-border bg-bg-elevated space-y-2">
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as typeof linkType)}
            className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {Object.entries(LINK_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm task..."
            className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-subtle"
          />
          {filtered.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden max-h-40 overflow-y-auto">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-bg-subtle transition-colors',
                    selectedId === t.id && 'bg-bg-active text-accent'
                  )}
                >
                  {selectedId === t.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => selectedId && addLink()} disabled={!selectedId} loading={isPending}>Link</Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setSearch(''); setSelectedId('') }}>Hủy</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: All ─────────────────────────────────────────────────────────────────

function AllTab({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { data: comments = [], isLoading: cLoading } = useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => commentsApi.list(projectId, taskId),
  })
  const { data: activity = [], isLoading: aLoading } = useQuery({
    queryKey: ['activity', projectId, 'task', taskId],
    queryFn: () => apiClient.get<{ success: true; data: ActivityLog[] }>(`/projects/${projectId}/activity`, {
      params: { entityType: 'task', entityId: taskId, limit: 50 }
    }).then(r => r.data.data),
  })

  if (cLoading || aLoading) return <TimelineSkeleton />

  const items = [
    ...comments.map(c => ({ type: 'comment' as const, date: c.createdAt, data: c })),
    ...activity.map(a => ({ type: 'activity' as const, date: a.createdAt, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (!items.length) return <p className="text-sm text-fg-subtle text-center py-8">Chưa có hoạt động nào</p>

  return (
    <div className="space-y-3">
      {items.map((item) => item.type === 'comment'
        ? <CommentBubble key={`c-${item.data.id}`} comment={item.data as Comment} mini />
        : <HistoryItem key={`a-${item.data.id}`} log={item.data as ActivityLog} />
      )}
    </div>
  )
}

// ─── Tab: Comments ────────────────────────────────────────────────────────────

function CommentsTab({ projectId, taskId }: { projectId: string; taskId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuthStore()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => commentsApi.list(projectId, taskId),
  })

  const { mutate: addComment, isPending } = useMutation({
    mutationFn: (dto: { content: string; parentId?: string }) =>
      commentsApi.create(projectId, taskId, dto),
    onMutate: async ({ content: c, parentId }) => {
      const optimistic: Comment = {
        id: 'tmp-' + Date.now(),
        taskId, authorId: user!.id,
        author: { id: user!.id, fullName: user!.fullName, email: '', avatarUrl: user!.avatarUrl ?? null },
        content: c, parentId: parentId ?? null,
        editedAt: null, createdAt: new Date().toISOString(),
      }
      qc.setQueryData(['comments', projectId, taskId], (old: Comment[]) => [...(old ?? []), optimistic])
      setContent(''); setReplyTo(null)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] }),
    onError: () => { toast.error('Gửi thất bại'); qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] }) },
  })

  const { mutate: updateComment } = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => commentsApi.update(projectId, taskId, id, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] }); setEditing(null) },
  })

  const { mutate: deleteComment } = useMutation({
    mutationFn: (id: string) => commentsApi.delete(projectId, taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] }),
  })

  const topLevel = comments.filter(c => !c.parentId)
  const getReplies = (id: string) => comments.filter(c => c.parentId === id)

  if (isLoading) return <TimelineSkeleton />

  const quickReplies = ["Who is working on this?", "Can I get more info?", "Status update?"]

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <p className="text-sm text-fg-subtle text-center py-4">Chưa có comment nào</p>
      )}
      {topLevel.map((c) => (
        <CommentBubble
          key={c.id}
          comment={c}
          replies={getReplies(c.id)}
          currentUserId={user?.id}
          editing={editing}
          onReply={setReplyTo}
          onEdit={setEditing}
          onUpdate={(id, content) => updateComment({ id, content })}
          onDelete={deleteComment}
        />
      ))}

      {/* Input area */}
      <div className="pt-2 border-t border-border">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-fg-muted bg-bg-subtle rounded-lg px-2.5 py-1.5 mb-2">
            Trả lời <strong>{replyTo.author.fullName}</strong>
            <button onClick={() => setReplyTo(null)} className="ml-auto hover:text-fg">✕</button>
          </div>
        )}

        {/* Quick replies */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickReplies.map(q => (
            <button
              key={q}
              onClick={() => setContent(q)}
              className="text-xs px-2 py-1 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {user && <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" className="shrink-0 mt-1" />}
          <div className="flex-1 space-y-1.5">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.key === 'Enter' && content.trim()) {
                  e.preventDefault()
                  addComment({ content: content.trim(), parentId: replyTo?.id })
                }
              }}
              placeholder="Add a comment... (Shift+Enter to send)"
              rows={2}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-subtle"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-subtle">Press M to comment</span>
              <Button variant="primary" size="sm" disabled={!content.trim()} loading={isPending} onClick={() => addComment({ content: content.trim(), parentId: replyTo?.id })}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Comment Bubble ───────────────────────────────────────────────────────────

function CommentBubble({
  comment, replies, currentUserId, editing, onReply, onEdit, onUpdate, onDelete, mini
}: {
  comment: Comment; replies?: Comment[]; currentUserId?: string
  editing?: { id: string; content: string } | null
  onReply?: (c: Comment) => void; onEdit?: (e: { id: string; content: string } | null) => void
  onUpdate?: (id: string, content: string) => void; onDelete?: (id: string) => void
  mini?: boolean
}) {
  const isOwn = comment.authorId === currentUserId
  const isEditing = editing?.id === comment.id

  return (
    <div className="flex gap-2.5 group">
      <Avatar name={comment.author.fullName} avatarUrl={comment.author.avatarUrl} size="sm" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-fg">{comment.author.fullName}</span>
          <span className="text-xs text-fg-subtle">{formatRelative(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-xs text-fg-subtle italic">(edited)</span>}
        </div>

        {isEditing && onEdit && onUpdate ? (
          <div className="space-y-1.5">
            <textarea
              value={editing!.content}
              onChange={(e) => onEdit({ ...editing!, content: e.target.value })}
              autoFocus rows={2}
              className="w-full bg-bg-elevated border border-accent rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => onUpdate(comment.id, editing!.content)}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg whitespace-pre-wrap break-words">{comment.content}</p>
        )}

        {!mini && (
          <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onReply && (
              <button onClick={() => onReply(comment)} className="text-xs text-fg-subtle hover:text-accent transition-colors">
                Reply
              </button>
            )}
            {isOwn && !isEditing && onEdit && onDelete && (
              <>
                <button onClick={() => onEdit({ id: comment.id, content: comment.content })} className="text-xs text-fg-subtle hover:text-fg">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => onDelete(comment.id)} className="text-xs text-fg-subtle hover:text-danger">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )}

        {replies && replies.length > 0 && (
          <div className="mt-2 pl-3 border-l-2 border-border space-y-2">
            {replies.map(r => (
              <CommentBubble
                key={r.id} comment={r} currentUserId={currentUserId}
                editing={editing} onEdit={onEdit} onUpdate={onUpdate} onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string; action: string; entityType: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string; userId: string
  user?: { fullName: string; avatarUrl: string | null }
}

function HistoryTab({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity', projectId, 'task', taskId],
    queryFn: () => apiClient.get<{ success: true; data: ActivityLog[] }>(`/projects/${projectId}/activity`, {
      params: { entityType: 'task', entityId: taskId, limit: 50 }
    }).then(r => r.data.data),
  })

  if (isLoading) return <TimelineSkeleton />
  if (!logs.length) return <p className="text-sm text-fg-subtle text-center py-8">Chưa có lịch sử</p>

  return (
    <div className="space-y-2">
      {logs.map(log => <HistoryItem key={log.id} log={log} />)}
    </div>
  )
}

function HistoryItem({ log }: { log: ActivityLog }) {
  const actionLabel: Record<string, string> = {
    created: 'created this task',
    updated: 'updated',
    status_changed: 'changed status',
    moved: 'moved task',
    assigned: 'assigned',
    commented: 'commented',
    deleted: 'deleted',
  }

  return (
    <div className="flex gap-2.5 text-xs text-fg-muted">
      <div className="w-1.5 h-1.5 rounded-full bg-border mt-1.5 shrink-0" />
      <div className="flex-1">
        <span className="font-medium text-fg">{log.user?.fullName ?? 'System'}</span>
        {' '}{actionLabel[log.action] ?? log.action}
        {log.newValues && Object.keys(log.newValues).length > 0 && (
          <span className="text-fg-subtle"> · {Object.entries(log.newValues).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
        )}
        <span className="ml-2 text-fg-subtle">{formatRelative(log.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Tab: Work Log ────────────────────────────────────────────────────────────

function WorkLogTab({ task, onUpdate }: { task: Task; onUpdate: (dto: UpdateTaskDto) => void }) {
  const [timeInput, setTimeInput] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [inputError, setInputError] = useState('')

  const logTime = () => {
    const h = parseTimeInput(timeInput)
    if (!h) { setInputError('Format: 2w 4d 6h 45m'); return }
    setInputError('')
    const current = Number(task.loggedHours) || 0
    onUpdate({ loggedHours: current + h })
    setTimeInput('')
  }

  const logged = Number(task.loggedHours) || 0
  const estimated = Number(task.estimatedHours) || 0
  const remaining = Math.max(0, estimated - logged)

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-bg-elevated space-y-3">
        <p className="text-sm font-semibold text-fg">Log time</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-fg-subtle mb-1 block">Time spent</label>
            <input
              type="text" value={timeInput}
              onChange={(e) => { setTimeInput(e.target.value); setInputError('') }}
              onKeyDown={(e) => e.key === 'Enter' && logTime()}
              placeholder="2h 30m"
              className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
            />
            {inputError && <p className="text-xs text-danger mt-0.5">{inputError}</p>}
          </div>
          <div>
            <label className="text-xs text-fg-subtle mb-1 block">Date</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
        <p className="text-xs text-fg-subtle">Format: 2w 4d 6h 45m (1w=5d, 1d=8h)</p>
        <Button variant="primary" size="sm" onClick={logTime} disabled={!timeInput.trim()}>Log time</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Estimated', value: formatTimeHours(estimated) },
          { label: 'Logged',    value: formatTimeHours(logged) },
          { label: 'Remaining', value: formatTimeHours(remaining) },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 rounded-xl border border-border bg-bg-elevated text-center">
            <p className="text-sm font-bold text-fg">{value}</p>
            <p className="text-xs text-fg-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Right Column ─────────────────────────────────────────────────────────────

function RightColumn({ task, projectId, projectKey = 'TASK', onUpdate }: {
  task: Task; projectId: string; projectKey?: string; onUpdate: (dto: UpdateTaskDto) => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [devOpen, setDevOpen] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })
  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
  })

  return (
    <div className="w-[400px] min-w-[400px] shrink-0 border-l border-border overflow-y-auto scrollbar-thin flex flex-col">

      {/* Status + quick actions */}
      <div className="px-5 py-4 border-b border-border space-y-2">
        <StatusDropdown task={task} onUpdate={onUpdate} />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Automation
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-accent border-accent/30">
            ✨ Improve
          </Button>
        </div>
      </div>

      {/* Details */}
      <CollapsibleSection
        title="Details"
        open={detailsOpen}
        onToggle={() => setDetailsOpen(v => !v)}
      >
        <div className="space-y-0">
          {/* Assignee */}
          <FieldRow label="Assignee" icon={<User className="w-3.5 h-3.5" />}>
            <AssigneeField task={task} members={members} onUpdate={onUpdate} />
          </FieldRow>

          {/* Priority */}
          <FieldRow label="Priority" icon={<Flag className="w-3.5 h-3.5" />}>
            <PriorityField task={task} onUpdate={onUpdate} />
          </FieldRow>

          {/* Due date */}
          <FieldRow label="Due date" icon={<Calendar className="w-3.5 h-3.5" />} align="center">
            <DueDateField task={task} onUpdate={onUpdate} />
          </FieldRow>

          {/* Labels */}
          <FieldRow label="Labels" icon={<Tag className="w-3.5 h-3.5" />}>
            <LabelsField task={task} labels={labels} projectId={projectId} onUpdate={onUpdate} />
          </FieldRow>

          {/* Reporter */}
          <FieldRow label="Reporter" icon={<User className="w-3.5 h-3.5" />}>
            {task.reporter ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={task.reporter.fullName} avatarUrl={task.reporter.avatarUrl} size="xs" />
                <span className="text-sm text-fg">{task.reporter.fullName}</span>
              </div>
            ) : <span className="text-sm text-fg-muted">—</span>}
          </FieldRow>

          {/* Story points */}
          <FieldRow label="Story points" icon={<CheckSquare className="w-3.5 h-3.5" />}>
            <input
              type="number" min={0}
              defaultValue={task.storyPoints ?? ''}
              onBlur={(e) => onUpdate({ storyPoints: Number(e.target.value) || undefined })}
              placeholder="None"
              className="w-16 text-sm text-fg bg-transparent focus:outline-none focus:bg-bg-elevated focus:px-2 focus:rounded-md placeholder:text-fg-muted"
            />
          </FieldRow>

          {/* Time tracking */}
          <FieldRow label="Time tracking" icon={<CheckSquare className="w-3.5 h-3.5" />}>
            <TimeTrackingField task={task} projectId={projectId} />
          </FieldRow>

          {/* Parent task */}
          <FieldRow label="Parent" icon={<AlignLeft className="w-3.5 h-3.5" />}>
            {task.parentTask?.taskNumber != null ? (
              <span className="flex items-center gap-1 text-sm text-fg-muted">
                <TaskIcon size={12} />
                {projectKey}-{task.parentTask.taskNumber}
              </span>
            ) : task.parentTaskId ? (
              <span className="text-sm text-fg-muted">{projectKey}-?</span>
            ) : (
              <span className="text-sm text-fg-muted">None</span>
            )}
          </FieldRow>

          {/* Team (stub) */}
          <FieldRow label="Team" icon={<User className="w-3.5 h-3.5" />}>
            <span className="text-sm text-fg-muted">None</span>
          </FieldRow>

          {/* Start date */}
          <FieldRow label="Start date" icon={<Calendar className="w-3.5 h-3.5" />}>
            <StartDateField task={task} onUpdate={onUpdate} />
          </FieldRow>
        </div>
      </CollapsibleSection>

      {/* Development */}
      <CollapsibleSection
        title="Development"
        open={devOpen}
        onToggle={() => setDevOpen(v => !v)}
      >
        <CreateBranchPanel task={task} />
      </CollapsibleSection>

      {/* Automation */}
      <CollapsibleSection
        title="Automation"
        open={autoOpen}
        onToggle={() => setAutoOpen(v => !v)}
        badge={<Zap className="w-3.5 h-3.5 text-warning" />}
      >
        <p className="text-xs text-fg-muted">No active rules for this task.</p>
      </CollapsibleSection>

      {/* Footer */}
      <div className="mt-auto px-5 py-4 border-t border-border">
        <div className="text-xs text-fg-subtle space-y-1 mb-3">
          <p>Created {formatRelative(task.createdAt)}</p>
          <p>Updated {formatRelative(task.updatedAt)}</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors">
          <Zap className="w-3.5 h-3.5" />
          Configure
        </button>
      </div>
    </div>
  )
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────

function StatusDropdown({ task, onUpdate }: { task: Task; onUpdate: (dto: UpdateTaskDto) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const sc = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        style={{ backgroundColor: sc.hexBg, color: sc.hexColor }}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
      >
        {sc.label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-bg-surface shadow-app-md overflow-hidden">
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <button
              key={v}
              onClick={() => { onUpdate({ status: v }); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-subtle transition-colors"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: c.hexBg }}
              />
              <span style={{ color: v === task.status ? c.hexColor === '#FFFFFF' ? c.color : undefined : undefined }}
                className={cn('flex-1 text-left text-fg', v === task.status && 'font-medium')}>
                {c.label}
              </span>
              {v === task.status && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Assignee Field ───────────────────────────────────────────────────────────

function AssigneeField({ task, members, onUpdate }: {
  task: Task; members: Array<{ userId: string; user: { fullName: string; avatarUrl: string | null } }>
  onUpdate: (dto: UpdateTaskDto) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { user: me } = useAuthStore()

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Use task.assignee object directly (from store/server); fallback to members list lookup
  const assigneeUser = task.assignee ?? members.find(m => m.userId === task.assigneeId)?.user ?? null

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 hover:text-fg transition-colors">
        {assigneeUser
          ? <><Avatar name={assigneeUser.fullName} avatarUrl={assigneeUser.avatarUrl} size="xs" /><span className="text-sm text-fg">{assigneeUser.fullName}</span></>
          : <span className="text-sm text-fg-muted">Unassigned</span>
        }
      </button>
      {!task.assigneeId && (
        <button
          onClick={() => { onUpdate({ assigneeId: me?.id }); setOpen(false) }}
          className="ml-2 text-xs text-accent hover:underline"
        >
          Assign to me
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-border bg-bg-surface shadow-app-md overflow-hidden">
          <button
            onClick={() => { onUpdate({ assigneeId: null }); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle"
          >
            Unassigned
          </button>
          {members.map(m => (
            <button
              key={m.userId}
              onClick={() => { onUpdate({ assigneeId: m.userId }); setOpen(false) }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-subtle', m.userId === task.assigneeId && 'bg-bg-active')}
            >
              <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="xs" />
              {m.user.fullName}
              {m.userId === task.assigneeId && <Check className="w-3.5 h-3.5 ml-auto text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Labels Field ─────────────────────────────────────────────────────────────

const LABEL_COLORS = [
  '#FF5630','#FF7A00','#FFA500','#FFAB00',
  '#36B37E','#00B8D9','#0052CC','#6554C0',
  '#97A0AF','#42526E',
]

function LabelsField({ task, labels, projectId, onUpdate }: {
  task: Task
  labels: Array<{ id: string; name: string; color: string }>
  projectId: string
  onUpdate: (dto: UpdateTaskDto) => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(LABEL_COLORS[5])
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const labelIds = task.labels.map(l => l.id)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setCreating(false) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const toggle = (labelId: string) => {
    const next = labelIds.includes(labelId)
      ? labelIds.filter(id => id !== labelId)
      : [...labelIds, labelId]
    onUpdate({ labelIds: next })
  }

  const remove = (e: React.MouseEvent, labelId: string) => {
    e.stopPropagation()
    onUpdate({ labelIds: labelIds.filter(id => id !== labelId) })
  }

  const createLabel = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await labelsApi.create(projectId, { name, color: newColor })
    qc.invalidateQueries({ queryKey: ['labels', projectId] })
    onUpdate({ labelIds: [...labelIds, created.id] })
    setNewName('')
    setCreating(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Chips */}
      <div className="flex flex-wrap gap-1">
        {task.labels.length === 0 && !open && (
          <span className="text-sm text-fg-muted">None</span>
        )}
        {task.labels.map(l => (
          <span
            key={l.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium text-white group"
            style={{ backgroundColor: l.color }}
          >
            {l.name}
            <button
              onClick={(e) => remove(e, l.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:bg-black/20 rounded-full"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-fg-muted hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-lg border border-border bg-bg-surface shadow-app-md overflow-hidden">
          {/* Existing labels */}
          <div className="max-h-40 overflow-y-auto">
            {labels.length === 0 && !creating && (
              <p className="px-3 py-2 text-xs text-fg-muted">Chưa có label nào</p>
            )}
            {labels.map(l => {
              const active = labelIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-subtle"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="flex-1 text-left text-fg truncate">{l.name}</span>
                  {active && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Create inline */}
          {creating ? (
            <div className="border-t border-border p-2 space-y-2">
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createLabel(); if (e.key === 'Escape') setCreating(false) }}
                placeholder="Tên label..."
                className="w-full text-sm bg-bg-elevated border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent text-fg placeholder:text-fg-muted"
              />
              <div className="flex gap-1 flex-wrap">
                {LABEL_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, outline: c === newColor ? '2px solid white' : 'none', outlineOffset: '-3px' }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={createLabel}
                  disabled={!newName.trim()}
                  className="flex-1 text-xs py-1 rounded-md bg-accent text-white disabled:opacity-40"
                >
                  Tạo
                </button>
                <button onClick={() => setCreating(false)} className="text-xs py-1 px-2 rounded-md border border-border text-fg-muted hover:text-fg">
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-fg-muted border-t border-border hover:bg-bg-subtle"
            >
              <Plus className="w-3 h-3" /> Tạo label mới
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Priority Field ───────────────────────────────────────────────────────────

function PriorityField({ task, onUpdate }: { task: Task; onUpdate: (dto: UpdateTaskDto) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pc = PRIORITY_CONFIG[task.priority]

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
        {pc
          ? <><img src={pc.svg} alt={pc.label} width={16} height={16} className="shrink-0" />
              <span className="text-sm" style={{ color: pc.hexColor }}>{pc.label}</span></>
          : <span className="text-sm text-fg-muted">None</span>
        }
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-40 rounded-lg border border-border bg-bg-surface shadow-app-md overflow-hidden">
          {Object.entries(PRIORITY_CONFIG).map(([v, c]) => (
            <button
              key={v}
              onClick={() => { onUpdate({ priority: v }); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg-subtle"
            >
              <img src={c.svg} alt={c.label} width={16} height={16} className="shrink-0" />
              <span style={{ color: c.hexColor }}>{c.label}</span>
              {v === task.priority && <Check className="w-3.5 h-3.5 text-accent ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Due Date Field ───────────────────────────────────────────────────────────

function DueDateField({ task, onUpdate }: { task: Task; onUpdate: (dto: UpdateTaskDto) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOverdue =
    task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date()

  useEffect(() => {
    if (editing) inputRef.current?.showPicker?.()
  }, [editing])

  const fmt = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleQuick = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    const iso = d.toISOString().slice(0, 10)
    onUpdate({ dueDate: iso })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          defaultValue={task.dueDate?.slice(0, 10) ?? ''}
          onBlur={(e) => { onUpdate({ dueDate: e.target.value || undefined }); setEditing(false) }}
          onChange={(e) => { if (e.target.value) { onUpdate({ dueDate: e.target.value }); setEditing(false) } }}
          className="w-full text-sm text-fg bg-bg-elevated border border-accent rounded-md px-2 py-1 focus:outline-none"
          autoFocus
        />
        <div className="absolute top-full left-0 mt-1 z-50 flex gap-1 bg-bg-surface border border-border rounded-lg p-1.5 shadow-app-md">
          {[['Today', 0], ['Tomorrow', 1], ['Next week', 7]].map(([label, days]) => (
            <button
              key={label as string}
              onClick={() => handleQuick(days as number)}
              className="px-2 py-1 text-xs rounded-md bg-bg-elevated hover:bg-accent hover:text-white transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { onUpdate({ dueDate: null }); setEditing(false) }}
            className="px-2 py-1 text-xs rounded-md text-danger hover:bg-danger/10 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn('w-fit flex items-center gap-1 text-sm rounded-[4px] px-1.5 py-0.5 border transition-colors', isOverdue ? 'bg-[#FFEBE6] text-[#ae2e24] hover:bg-[#FFEBE6]/80' : 'bg-white text-[#292a2e] hover:bg-bg-subtle')}
      style={{ borderColor: isOverdue ? '#ae2e24' : '#0B120E24' }}
    >
      {isOverdue && (
        <svg width="14" height="14" fill="none" viewBox="0 0 16 16" className="shrink-0">
          <path fill="currentColor" fillRule="evenodd" d="M5.7 1.383c.996-1.816 3.605-1.817 4.602-.002l5.35 9.73C16.612 12.86 15.346 15 13.35 15H2.667C.67 15-.594 12.862.365 11.113zm3.288.72a1.125 1.125 0 0 0-1.972.002L1.68 11.834c-.41.75.132 1.666.987 1.666H13.35c.855 0 1.398-.917.986-1.667z" clipRule="evenodd"/>
          <path fill="currentColor" fillRule="evenodd" d="M7.25 9V4h1.5v5z" clipRule="evenodd"/>
          <path fill="currentColor" d="M9 11.25a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
        </svg>
      )}
      <Calendar className="w-3.5 h-3.5" />
      {task.dueDate ? fmt(task.dueDate) : <span className="text-fg-muted">None</span>}
    </button>
  )
}

// ─── Time Tracking Field ──────────────────────────────────────────────────────

function TimeTrackingField({ task, projectId }: { task: Task; projectId: string }) {
  const [showModal, setShowModal] = useState(false)
  const [timeInput, setTimeInput] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [inputError, setInputError] = useState('')
  const [remainingMode, setRemainingMode] = useState<'auto' | 'manual' | 'keep'>('auto')
  const [manualRemaining, setManualRemaining] = useState('')
  const [description, setDescription] = useState('')
  const toast = useToast()
  const qc = useQueryClient()

  const logged    = Number(task.loggedHours)   || 0
  const estimated = Number(task.estimatedHours) || 0
  const hasLogged = logged > 0
  const overBudget = estimated > 0 && logged > estimated
  const pct = estimated > 0
    ? Math.min((logged / estimated) * 100, 100)
    : hasLogged ? 100 : 0
  const fillColor = overBudget ? '#FF5630' : '#0052CC'
  const tooltipText = estimated > 0
    ? `${formatTimeHours(logged)} of ${formatTimeHours(estimated)} logged (${Math.round(pct)}%)`
    : `${formatTimeHours(logged)} logged`

  const { mutate: doLogTime, isPending } = useMutation({
    mutationFn: async (h: number) => {
      const updated = await tasksApi.logTime(projectId, task.id, {
        hours: h,
        loggedDate: date,
        description: description.trim() || undefined,
      })
      // Update estimated_hours based on remaining mode
      if (remainingMode === 'auto' && estimated > 0) {
        const newEstimated = Math.max(logged + h, estimated - h)
        if (newEstimated !== estimated) {
          await tasksApi.update(projectId, task.id, { estimatedHours: newEstimated })
        }
      } else if (remainingMode === 'manual') {
        const remaining = parseTimeInput(manualRemaining)
        await tasksApi.update(projectId, task.id, { estimatedHours: logged + h + remaining })
      }
      return updated
    },
    onSuccess: (updated) => {
      qc.setQueryData(['task', projectId, task.id], updated)
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Time logged successfully')
      setTimeInput(''); setDescription(''); setManualRemaining('')
      setShowModal(false)
    },
    onError: () => toast.error('Log time thất bại'),
  })

  const logTime = () => {
    const h = parseTimeInput(timeInput)
    if (!h) { setInputError('Format: 2w 4d 6h 45m'); return }
    setInputError('')
    doLogTime(h)
  }

  const closeModal = () => {
    setShowModal(false)
    setTimeInput(''); setInputError(''); setDescription(''); setManualRemaining('')
    setRemainingMode('auto')
  }

  return (
    <div className="w-full">
      {/* ── Display ── */}
      {!hasLogged ? (
        <button
          onClick={() => setShowModal(true)}
          className="text-sm hover:text-accent transition-colors"
          style={{ color: '#42526E' }}
        >
          No time logged
        </button>
      ) : (
        <button onClick={() => setShowModal(true)} title={tooltipText} className="w-full text-left group space-y-1">
          {/* Bar */}
          <div className="w-full rounded-sm overflow-hidden" style={{ height: 4, backgroundColor: '#DFE1E6' }}>
            <div
              className="h-full rounded-sm transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: fillColor }}
            />
          </div>
          {/* Label */}
          <p
            className="text-xs leading-none group-hover:opacity-75 transition-opacity"
            style={{ color: overBudget ? '#FF5630' : '#42526E', fontSize: 13 }}
          >
            {estimated > 0
              ? `${formatTimeHours(logged)} logged / ${formatTimeHours(estimated)} estimated`
              : `${formatTimeHours(logged)} logged`}
          </p>
        </button>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-bg-surface border border-border rounded-xl shadow-app-lg w-[500px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-fg">Log time</h3>
              <button onClick={closeModal} className="text-fg-muted hover:text-fg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Time spent */}
              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">Time spent</label>
                <input
                  autoFocus
                  type="text" value={timeInput}
                  onChange={(e) => { setTimeInput(e.target.value); setInputError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && logTime()}
                  placeholder="2h 30m"
                  className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
                />
                {inputError
                  ? <p className="text-xs text-danger mt-1">{inputError}</p>
                  : <p className="text-xs text-fg-subtle mt-1">Accepts: 2h, 30m, 1h 30m, 2w 4d 6h 45m</p>
                }
              </div>

              {/* Date logged */}
              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">Date logged</label>
                <input
                  type="date" value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Remaining estimate */}
              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">Remaining estimate</label>
                <div className="space-y-1.5">
                  {([
                    { value: 'auto', label: 'Auto: subtract logged time' },
                    { value: 'manual', label: 'Set manually' },
                    { value: 'keep', label: "Don't change" },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio" name="rem" value={opt.value}
                        checked={remainingMode === opt.value}
                        onChange={() => setRemainingMode(opt.value)}
                        className="accent-accent w-3.5 h-3.5"
                      />
                      <span className="text-sm text-fg">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {remainingMode === 'manual' && (
                  <input
                    type="text" value={manualRemaining}
                    onChange={(e) => setManualRemaining(e.target.value)}
                    placeholder="e.g. 2h"
                    autoFocus
                    className="mt-2 w-full h-8 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
                  />
                )}
              </div>

              {/* Work description */}
              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">Work description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you work on?"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-subtle px-2.5 py-2 text-sm text-fg resize-none focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-border">
              <Button variant="ghost" size="sm" onClick={closeModal}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!timeInput.trim()} loading={isPending} onClick={logTime}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Start Date Field ─────────────────────────────────────────────────────────

function StartDateField({ task, onUpdate }: { task: Task; onUpdate: (dto: UpdateTaskDto) => void }) {
  const toast = useToast()

  return (
    <input
      type="date"
      defaultValue={(task as Task & { startDate?: string }).startDate?.slice(0, 10) ?? ''}
      max={task.dueDate?.slice(0, 10) ?? ''}
      onChange={(e) => {
        const val = e.target.value
        if (task.dueDate && val > task.dueDate.slice(0, 10)) {
          toast.error('Start date không được sau due date')
          e.target.value = (task as Task & { startDate?: string }).startDate?.slice(0, 10) ?? ''
          return
        }
        onUpdate({ dueDate: task.dueDate } as UpdateTaskDto) // trigger save via parent
      }}
      className="text-sm text-fg bg-transparent focus:outline-none cursor-pointer hover:text-accent"
    />
  )
}

// ─── Create Branch Panel ──────────────────────────────────────────────────────

function CreateBranchPanel({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const taskId = `KAN-${(task.position ?? 0) + 1}`
  const [branchName, setBranchName] = useState(`${taskId.toLowerCase()}-${slug}`)
  const command = `git checkout -b ${branchName}`

  const copyCommand = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    toast.success('Đã copy lệnh')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-fg-muted hover:text-fg hover:border-accent/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> Create branch
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="rounded-lg border border-border bg-bg-elevated p-3 space-y-2">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
            GIT CREATE & CHECKOUT A NEW BRANCH
          </p>
          <div className="flex items-center gap-2">
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="flex-1 bg-bg-subtle border border-border rounded-md px-2 py-1.5 text-xs font-mono text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={copyCommand}
              title={copied ? 'Copied!' : 'Copy command'}
              className={cn(
                'shrink-0 flex items-center justify-center w-8 h-8 rounded-md border border-border transition-colors',
                copied ? 'bg-success/10 border-success text-success' : 'hover:bg-bg-subtle text-fg-muted hover:text-fg',
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-xs font-mono text-fg-muted bg-bg-subtle rounded px-2 py-1 select-all">
            {command}
          </p>
        </div>
      )}

      <div className="flex gap-1.5 text-xs text-fg-muted">
        <button className="flex items-center gap-1 hover:text-accent transition-colors">
          <Link2 className="w-3 h-3" /> Link PR
        </button>
        <span>·</span>
        <button className="flex items-center gap-1 hover:text-accent transition-colors">
          <Link2 className="w-3 h-3" /> Link commit
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CollapsibleSection({ title, open, onToggle, children, badge }: {
  title: string; open: boolean; onToggle: () => void
  children: React.ReactNode; badge?: React.ReactNode
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-fg-subtle uppercase tracking-wide hover:text-fg transition-colors"
      >
        <span className="flex items-center gap-1.5">{badge}{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

function FieldRow({ label, icon, children, align = 'start' }: {
  label: string; icon: React.ReactNode; children: React.ReactNode; align?: 'start' | 'center'
}) {
  return (
    <div className={cn('flex gap-2 py-2 border-b border-border/50 last:border-0', align === 'center' ? 'items-center' : 'items-start')}>
      <div className={cn('flex items-center gap-1.5 w-28 shrink-0 text-xs text-fg-muted', align === 'start' && 'pt-0.5')}>
        {icon}{label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <Skeleton className="flex-1 h-12 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
