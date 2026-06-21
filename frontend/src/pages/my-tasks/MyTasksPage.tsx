import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
    onSuccess: () => { invalidate(); toast.success(t('myTasks.markedDone')) },
    onError: () => toast.error(t('myTasks.updateFailed')),
  })
  const { mutate: archive } = useMutation({
    mutationFn: (task: MyTask) => tasksApi.archive(task.projectId, task.id),
    onSuccess: () => { invalidate(); toast.success(t('myTasks.archived')) },
    onError: () => toast.error(t('myTasks.archiveFailed')),
  })

  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  )

  const statCards = [
    { label: t('myTasks.statAssigned'), value: stats?.total ?? 0, icon: <ListTodo className="w-4 h-4 text-accent" /> },
    { label: t('myTasks.statDueToday'), value: stats?.dueToday ?? 0, icon: <CalendarClock className="w-4 h-4 text-info" /> },
    { label: t('myTasks.statOverdue'), value: stats?.overdue ?? 0, icon: <AlertTriangle className="w-4 h-4 text-danger" /> },
    { label: t('myTasks.statInProgress'), value: stats?.inProgress ?? 0, icon: <Loader className="w-4 h-4 text-warning" /> },
    { label: t('myTasks.statCompleted'), value: stats?.completed ?? 0, icon: <CheckCircle2 className="w-4 h-4 text-success" /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">{t('nav.myTasks')}</h1>
        <p className="text-xs text-fg-muted mt-0.5">{t('pages.myTasksSubtitle')}</p>
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
          {([['assigned', t('myTasks.tabAssigned')], ['reported', t('myTasks.tabReported')], ['watching', t('myTasks.tabWatching')]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn('px-3 py-1.5 text-xs transition-colors', tab === k ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg')}>{l}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('filter.searchTasks')} className="h-8 w-44 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">{t('myTasks.allProjects')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">{t('myTasks.allStatuses')}</option>
          {Object.keys(STATUS_CFG).map((v) => <option key={v} value={v}>{t(`status.${v}`)}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">{t('myTasks.allPriorities')}</option>
          {Object.keys(PRIORITY_ICON).map((v) => <option key={v} value={v}>{t(`priority.${v}`)}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {tab === 'watching' ? (
          <EmptyState icon={<Eye className="w-12 h-12" />} title={t('myTasks.watchingTitle')} description={t('myTasks.watchingDesc')} />
        ) : isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<ListTodo className="w-12 h-12" />} title={t('myTasks.emptyTitle')} />
        ) : (
          <div className="rounded-card border border-border overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <th className="px-4 py-2.5 font-semibold">{t('myTasks.colTask')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('myTasks.colProject')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('myTasks.colStatus')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('myTasks.colPriority')}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{t('myTasks.colDue')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('myTasks.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((task) => {
                  const pr = PRIORITY_ICON[task.priority] ?? PRIORITY_ICON.medium
                  const st = STATUS_CFG[task.status]
                  const prLabel = t(`priority.${task.priority}`)
                  const overdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'done'
                  return (
                    <tr key={task.id} className="border-t border-border hover:bg-bg-subtle/40">
                      <td className="px-4 py-2.5">
                        <button onClick={() => setOpenTask(task)} className="flex items-center gap-2 min-w-0 text-left group">
                          <span className="text-xs font-mono text-fg-subtle shrink-0">{task.project ? getProjectKey(task.project.name) : 'TASK'}-{task.taskNumber ?? '—'}</span>
                          <span className="font-medium text-fg truncate group-hover:text-accent transition-colors">{task.title}</span>
                          {task.labels?.slice(0, 2).map((l) => <span key={l.id} className="hidden md:inline-flex rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: `${l.color}22`, color: l.color }}>{l.name}</span>)}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted text-xs truncate max-w-[160px]">{task.project?.name ?? projectName.get(task.projectId) ?? '—'}</td>
                      <td className="px-4 py-2.5"><span className={cn('inline-flex rounded border px-2 py-0.5 text-xs font-medium', st?.cls ?? 'text-fg-muted bg-bg-subtle border-border')}>{st ? t(`status.${task.status}`) : task.status}</span></td>
                      <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><img src={pr.svg} width={14} height={14} alt={prLabel} className="shrink-0" />{prLabel}</span></td>
                      <td className={cn('px-4 py-2.5 text-xs whitespace-nowrap', overdue ? 'text-danger font-medium' : 'text-fg-muted')}>{task.dueDate ? formatDate(task.dueDate, timezone) : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {task.status !== 'done' && (
                            <button onClick={() => markDone(task)} className="p-1.5 rounded-lg text-fg-muted hover:text-success hover:bg-success/10 transition-colors" title={t('myTasks.markDone')}><Check className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => archive(task)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title={t('myTasks.archive')}><Archive className="w-3.5 h-3.5" /></button>
                          {task.assignee && <Avatar name={task.assignee.fullName} avatarUrl={task.assignee.avatarUrl} size="xs" className="ml-1" />}
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
        task={null}
        taskId={openTask?.id}
        projectId={openTask?.projectId ?? ''}
        projectKey={openTask?.project ? getProjectKey(openTask.project.name) : 'TASK'}
        open={!!openTask}
        onClose={() => { setOpenTask(null); invalidate() }}
      />
    </div>
  )
}
