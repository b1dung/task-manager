import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListTodo, CalendarClock, AlertTriangle, CheckCircle2, Loader, Search, Check, Archive, Eye,
} from 'lucide-react'
import { myTasksApi, type MyTask } from '@/api/myTasks'
import { tasksApi } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { Avatar, EmptyState, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, cn } from '@/lib/utils'
import { TaskDetailModal } from '@/pages/board/components/TaskDetailModal'
import { useAuthStore } from '@/stores/useAuthStore'
import { DEFAULT_TIMEZONE } from '@/lib/timezones'

type Tab = 'assigned' | 'reported' | 'watching'

// Mirror the board's task representation (TaskCard) so fields stay in sync.
const PRIORITY_ICON: Record<string, { svg: string; label: string }> = {
  urgent: { svg: '/priority/highest_new.svg', label: 'Urgent' },
  high: { svg: '/priority/high_new.svg', label: 'High' },
  medium: { svg: '/priority/medium_new.svg', label: 'Medium' },
  low: { svg: '/priority/low_new.svg', label: 'Low' },
  lowest: { svg: '/priority/lowest_new.svg', label: 'Lowest' },
}
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  todo: { label: 'Todo', cls: 'text-fg-muted bg-bg-subtle border-border' },
  in_progress: { label: 'Progress', cls: 'text-info bg-info/10 border-info/30' },
  in_review: { label: 'Review', cls: 'text-warning bg-warning/10 border-warning/30' },
  done: { label: 'Done', cls: 'text-success bg-success/10 border-success/30' },
}

function getProjectKey(name: string): string {
  const w = name.trim().split(/\s+/)
  return w.length > 1 ? w.map((x) => x[0]).join('').toUpperCase() : name.slice(0, 5).toUpperCase()
}

export function MyTasksPage() {
  const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('assigned')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [openTask, setOpenTask] = useState<MyTask | null>(null)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list, staleTime: 60_000 })

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks', tab, debouncedSearch, projectId, status, priority],
    queryFn: () => myTasksApi.list({
      scope: tab === 'reported' ? 'reported' : 'assigned',
      q: debouncedSearch || undefined,
      projectId: projectId || undefined,
      status: status || undefined,
      priority: priority || undefined,
    }),
    enabled: tab !== 'watching',
  })
  const items = data?.items ?? []
  const stats = data?.stats

  const invalidate = () => qc.invalidateQueries({ queryKey: ['my-tasks'] })

  const { mutate: markDone } = useMutation({
    mutationFn: (t: MyTask) => tasksApi.update(t.projectId, t.id, { status: 'done' }),
    onSuccess: () => { invalidate(); toast.success('Đã đánh dấu hoàn thành') },
    onError: () => toast.error('Cập nhật thất bại'),
  })
  const { mutate: archive } = useMutation({
    mutationFn: (t: MyTask) => tasksApi.archive(t.projectId, t.id),
    onSuccess: () => { invalidate(); toast.success('Đã lưu trữ task') },
    onError: () => toast.error('Lưu trữ thất bại'),
  })

  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  )

  const statCards = [
    { label: 'Được giao', value: stats?.total ?? 0, icon: <ListTodo className="w-4 h-4 text-accent" /> },
    { label: 'Đến hạn hôm nay', value: stats?.dueToday ?? 0, icon: <CalendarClock className="w-4 h-4 text-info" /> },
    { label: 'Quá hạn', value: stats?.overdue ?? 0, icon: <AlertTriangle className="w-4 h-4 text-danger" /> },
    { label: 'Đang làm', value: stats?.inProgress ?? 0, icon: <Loader className="w-4 h-4 text-warning" /> },
    { label: 'Hoàn thành', value: stats?.completed ?? 0, icon: <CheckCircle2 className="w-4 h-4 text-success" /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">Task của tôi</h1>
        <p className="text-xs text-fg-muted mt-0.5">Toàn bộ task liên quan đến bạn, trên mọi dự án</p>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3">
          {statCards.map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-fg-muted">{c.icon}{c.label}</div>
              <p className="text-xl font-semibold text-fg mt-0.5">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border shrink-0 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden text-sm mr-auto">
          {([['assigned', 'Được giao'], ['reported', 'Tôi tạo'], ['watching', 'Theo dõi']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-1.5 text-xs transition-colors', tab === k ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg')}>{l}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm task..." className="h-8 w-44 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Mọi dự án</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">Mọi ưu tiên</option>
          {Object.entries(PRIORITY_ICON).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {tab === 'watching' ? (
          <EmptyState icon={<Eye className="w-12 h-12" />} title="Tính năng theo dõi task" description="Bạn sẽ thấy các task mình theo dõi ở đây. Sắp ra mắt." />
        ) : isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<ListTodo className="w-12 h-12" />} title="Không có task nào" />
        ) : (
          <div className="rounded-card border border-border overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <th className="px-4 py-2.5 font-semibold">Task</th>
                  <th className="px-4 py-2.5 font-semibold">Dự án</th>
                  <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-2.5 font-semibold">Ưu tiên</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Hạn</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const pr = PRIORITY_ICON[t.priority] ?? PRIORITY_ICON.medium
                  const st = STATUS_CFG[t.status]
                  const overdue = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== 'done'
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-bg-subtle/40">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setOpenTask(t)} className="flex items-center gap-2 min-w-0 text-left group">
                          <span className="text-xs font-mono text-fg-subtle shrink-0">{t.project ? getProjectKey(t.project.name) : 'TASK'}-{t.taskNumber ?? '—'}</span>
                          <span className="font-medium text-fg truncate group-hover:text-accent transition-colors">{t.title}</span>
                          {t.labels?.slice(0, 2).map((l) => <span key={l.id} className="hidden md:inline-flex rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${l.color}22`, color: l.color }}>{l.name}</span>)}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted text-xs truncate max-w-[160px]">{t.project?.name ?? projectName.get(t.projectId) ?? '—'}</td>
                      <td className="px-4 py-2.5"><span className={cn('inline-flex rounded border px-2 py-0.5 text-xs font-medium', st?.cls ?? 'text-fg-muted bg-bg-subtle border-border')}>{st?.label ?? t.status}</span></td>
                      <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><img src={pr.svg} width={14} height={14} alt={pr.label} className="shrink-0" />{pr.label}</span></td>
                      <td className={cn('px-4 py-2.5 text-xs whitespace-nowrap', overdue ? 'text-danger font-medium' : 'text-fg-muted')}>{t.dueDate ? formatDate(t.dueDate, timezone) : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {t.status !== 'done' && (
                            <button onClick={() => markDone(t)} className="p-1.5 rounded-lg text-fg-muted hover:text-success hover:bg-success/10 transition-colors" title="Đánh dấu hoàn thành"><Check className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => archive(t)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title="Lưu trữ"><Archive className="w-3.5 h-3.5" /></button>
                          {t.assignee && <Avatar name={t.assignee.fullName} avatarUrl={t.assignee.avatarUrl} size="xs" className="ml-1" />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskDetailModal
        taskId={openTask?.id}
        projectId={openTask?.projectId ?? ''}
        projectKey={openTask?.project ? getProjectKey(openTask.project.name) : 'TASK'}
        open={!!openTask}
        onClose={() => { setOpenTask(null); invalidate() }}
      />
    </div>
  )
}
