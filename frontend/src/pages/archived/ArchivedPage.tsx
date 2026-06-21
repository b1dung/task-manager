import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, ArchiveRestore, Trash2, Search, ListTodo, Folder, Bug, Bookmark, CheckSquare,
} from 'lucide-react'
import { archivedApi, type ArchivedTask, type ArchivedProject, type ArchivedUser } from '@/api/archived'
import { tasksApi } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { TaskDetailModal } from '@/pages/board/components/TaskDetailModal'
import { Avatar, Button, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useHasPermission } from '@/hooks/usePermissions'
import { formatRelative, cn } from '@/lib/utils'

const TYPE_ICON: Record<string, React.ReactNode> = {
  bug: <Bug className="w-3.5 h-3.5 text-danger" />,
  story: <Bookmark className="w-3.5 h-3.5 text-success" />,
}
function typeIcon(type: string) {
  return TYPE_ICON[type] ?? <CheckSquare className="w-3.5 h-3.5 text-accent" />
}

/** Same derivation the board uses for the {KEY}-{number} task id. */
function getProjectKey(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? words.map((w) => w[0]).join('').toUpperCase()
    : name.slice(0, 5).toUpperCase()
}

function ArchivedMeta({ at, by }: { at: string | null; by: ArchivedUser | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1.5 text-xs text-fg-subtle" title={at ? new Date(at).toLocaleString() : ''}>
      {by && <Avatar name={by.fullName} avatarUrl={by.avatarUrl} size="xs" />}
      <span>{by ? by.fullName : t('archived.system')} · {at ? formatRelative(at) : '—'}</span>
    </div>
  )
}

type Tab = 'tasks' | 'projects'

export function ArchivedPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const canManageProjects = useHasPermission('delete_project')

  const [tab, setTab] = useState<Tab>('tasks')
  const [search, setSearch] = useState('')
  const [deleteTask, setDeleteTask] = useState<ArchivedTask | null>(null)
  const [deleteProject, setDeleteProject] = useState<ArchivedProject | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['archived', projectId],
    queryFn: () => archivedApi.list(projectId),
  })

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
  })
  const projectKey = project ? getProjectKey(project.name) : 'TASK'
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks])
  const projects = useMemo(() => data?.projects ?? [], [data?.projects])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['archived', projectId] })
    qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
  }

  const q = search.trim().toLowerCase()
  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.title.toLowerCase().includes(q) || String(t.taskNumber ?? '').includes(q)),
    [tasks, q],
  )
  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)),
    [projects, q],
  )

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: restoreTask } = useMutation({
    mutationFn: (task: ArchivedTask) => tasksApi.unarchive(projectId, task.id).then(() => task),
    onSuccess: (task) => {
      invalidate()
      toast.undo(t('archived.restored', { title: task.title }), () => {
        tasksApi.archive(projectId, task.id).then(invalidate).catch(() => toast.error(t('archived.undoFailed')))
      }, 5000)
    },
    onError: () => toast.error(t('archived.restoreFailed')),
  })

  const { mutate: removeTask, isPending: deletingTask } = useMutation({
    mutationFn: (id: string) => tasksApi.delete(projectId, id),
    onSuccess: () => { invalidate(); toast.success(t('archived.deletedPermanently')); setDeleteTask(null) },
    onError: () => toast.error(t('archived.deleteFailed')),
  })

  const { mutate: restoreProject } = useMutation({
    mutationFn: (proj: ArchivedProject) => projectsApi.manageArchive(proj.id, false).then(() => proj),
    onSuccess: (proj) => {
      invalidate()
      toast.undo(t('archived.restoredProject', { name: proj.name }), () => {
        projectsApi.manageArchive(proj.id, true).then(invalidate).catch(() => toast.error(t('archived.undoFailed')))
      }, 5000)
    },
    onError: () => toast.error(t('archived.restoreProjectFailed')),
  })

  const { mutate: removeProject, isPending: deletingProject } = useMutation({
    mutationFn: (id: string) => projectsApi.manageDelete(id),
    onSuccess: () => { invalidate(); toast.success(t('archived.deletedProjectPermanently')); setDeleteProject(null) },
    onError: () => toast.error(t('archived.deleteProjectFailed')),
  })

  const chips = [
    { key: 'tasks' as Tab, label: 'tasks', count: tasks.length, icon: <ListTodo className="w-3.5 h-3.5" /> },
    ...(canManageProjects ? [{ key: 'projects' as Tab, label: 'projects', count: projects.length, icon: <Folder className="w-3.5 h-3.5" /> }] : []),
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Archive className="w-5 h-5 text-fg-muted" />
          <h1 className="text-base font-semibold text-fg">{t('pages.archived')}</h1>
        </div>
        <p className="text-xs text-fg-muted mt-0.5">{t('pages.archivedSubtitle')}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                tab === c.key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-fg-muted hover:text-fg',
              )}
            >
              {c.icon}<span className="font-medium">{c.count}</span> {c.key === 'tasks' ? t('archived.tabTasks') : t('archived.tabProjects')}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={cn('px-3 py-1.5 text-xs transition-colors', tab === c.key ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg')}
            >
              {c.key === 'tasks' ? t('archived.tabTasks') : t('archived.tabProjects')} ({c.count})
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter.searchPlaceholder')}
            className="h-8 w-56 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : tab === 'tasks' ? (
          filteredTasks.length === 0 ? (
            <EmptyState icon={<Archive className="w-12 h-12" />} title={t('archived.emptyTasksTitle')} description={t('archived.emptyTasksDesc')} />
          ) : (
            <Table head={['Task', t('archived.colStatus'), t('filter.assignee'), t('archived.colColumnSprint'), t('archived.colArchived'), '']}>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-border hover:bg-bg-subtle/40">
                  <td className="px-4 py-2.5">
                    <button onClick={() => setOpenTaskId(task.id)} className="flex items-center gap-2 min-w-0 text-left group">
                      {typeIcon(task.type)}
                      <span className="text-xs font-mono text-fg-subtle shrink-0">{projectKey}-{task.taskNumber ?? '—'}</span>
                      <span className="font-medium text-fg truncate group-hover:text-accent transition-colors">{task.title}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">{t(`status.${task.status}`, { defaultValue: task.status })}</span></td>
                  <td className="px-4 py-2.5">
                    {task.assignee ? (
                      <div className="flex items-center gap-2"><Avatar name={task.assignee.fullName} avatarUrl={task.assignee.avatarUrl} size="xs" /><span className="text-fg text-xs truncate">{task.assignee.fullName}</span></div>
                    ) : <span className="text-fg-subtle text-xs">{t('archived.unassigned')}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-fg-muted">
                    {task.columnName && <span className="inline-flex rounded bg-bg-subtle px-1.5 py-0.5 mr-1">{task.columnName}</span>}
                    {task.sprintName && <span className="inline-flex rounded bg-bg-subtle px-1.5 py-0.5">{task.sprintName}</span>}
                  </td>
                  <td className="px-4 py-2.5"><ArchivedMeta at={task.archivedAt} by={task.archivedBy} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => restoreTask(task)}><ArchiveRestore className="w-3.5 h-3.5" /> {t('archived.restore')}</Button>
                      <button onClick={() => setDeleteTask(task)} className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors" title={t('archived.deletePermanent')}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )
        ) : (
          filteredProjects.length === 0 ? (
            <EmptyState icon={<Archive className="w-12 h-12" />} title={t('archived.emptyProjectsTitle')} description={t('archived.emptyProjectsDesc')} />
          ) : (
            <Table head={[t('archived.colProject'), t('archived.colSize'), t('archived.colArchived'), '']}>
              {filteredProjects.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-bg-subtle/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent"><Folder className="w-3.5 h-3.5" /></span>
                      <div className="min-w-0"><p className="font-medium text-fg truncate">{p.name}</p><p className="text-xs text-fg-subtle font-mono truncate">{p.slug}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-fg-muted whitespace-nowrap">{t('archived.membersTasksCount', { members: p.memberCount, tasks: p.taskCount })}</td>
                  <td className="px-4 py-2.5"><ArchivedMeta at={p.archivedAt} by={p.archivedBy} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => restoreProject(p)}><ArchiveRestore className="w-3.5 h-3.5" /> {t('archived.restore')}</Button>
                      <button onClick={() => setDeleteProject(p)} className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors" title={t('archived.deletePermanent')}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTask}
        onClose={() => setDeleteTask(null)}
        onConfirm={() => deleteTask && removeTask(deleteTask.id)}
        title={t('archived.deleteTaskTitle')}
        message={deleteTask ? t('archived.deleteTaskMsg', { title: deleteTask.title }) : null}
        confirmLabel={t('archived.deletePermanent')}
        loading={deletingTask}
      />
      <ConfirmDialog
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
        onConfirm={() => deleteProject && removeProject(deleteProject.id)}
        title={t('archived.deleteProjectTitle')}
        message={deleteProject ? t('archived.deleteProjectMsg', { name: deleteProject.name }) : null}
        confirmLabel={t('archived.deletePermanent')}
        requireText={deleteProject?.slug}
        loading={deletingProject}
      />

      <TaskDetailModal
        task={null}
        taskId={openTaskId ?? undefined}
        projectId={projectId}
        projectKey={projectKey}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onOpenTask={(id) => setOpenTaskId(id)}
      />
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
            {head.map((h, i) => <th key={i} className={cn('px-4 py-2.5 font-semibold', i === head.length - 1 && 'text-right')}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
