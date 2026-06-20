import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks,
  startOfWeek, endOfWeek, isToday as dfIsToday, isAfter, parseISO, compareAsc,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Search, Plus, X } from 'lucide-react'
import { tasksApi, type Task, type CreateTaskDto } from '@/api/tasks'
import { membersApi } from '@/api/members'
import { columnsApi } from '@/api/columns'
import { projectsApi } from '@/api/projects'
import { Avatar, Button, Input, Modal, Skeleton, EmptyState } from '@/components/ui'
import { TaskDetailModal } from '@/pages/board/components/TaskDetailModal'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { DEFAULT_TIMEZONE, formatZonedDate, todayInTimezone, type UserTimezone } from '@/lib/timezones'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const PRIORITY_ICON: Record<string, string> = {
  urgent: '/priority/highest_new.svg',
  high: '/priority/high_new.svg',
  medium: '/priority/medium_new.svg',
  low: '/priority/low_new.svg',
  lowest: '/priority/lowest_new.svg',
}

// status → accent color (spec: Delivered green, Review purple, In Progress blue, To Do gray)
const STATUS_STYLE: Record<string, { bar: string; label: string }> = {
  todo: { bar: '#6b7280', label: 'To Do' },
  in_progress: { bar: '#3b82f6', label: 'In Progress' },
  in_review: { bar: '#8b5cf6', label: 'Review' },
  done: { bar: '#10b981', label: 'Delivered' },
}

const PRIORITY_OPTS = [
  { value: 'urgent', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
]
const STATUS_OPTS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'Review' },
  { value: 'done', label: 'Delivered' },
]

type ViewMode = 'month' | 'week' | 'agenda'

function getProjectKey(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? words.map((w) => w[0]).join('').toUpperCase()
    : name.slice(0, 5).toUpperCase()
}

export function CalendarPage() {
  const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
  const { projectId = '' } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const toast = useToast()

  const [currentDate, setCurrentDate] = useState(() => parseISO(todayInTimezone(timezone)))
  const [view, setView] = useState<ViewMode>('month')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [dayModal, setDayModal] = useState<Date | null>(null)
  const [createDay, setCreateDay] = useState<Date | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [fDeveloper, setFDeveloper] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPriority, setFPriority] = useState('')

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
  })
  const projectKey = project ? getProjectKey(project.name) : 'TASK'

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', projectId, 'calendar'],
    queryFn: () => tasksApi.list(projectId, { limit: 1000 }),
    enabled: !!projectId,
  })
  const allTasks = useMemo(() => data?.data ?? [], [data?.data])

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q) &&
          !(`${projectKey}-${t.taskNumber}`.toLowerCase().includes(q))) return false
      if (fDeveloper && t.assigneeId !== fDeveloper) return false
      if (fStatus && t.status !== fStatus) return false
      if (fPriority && t.priority !== fPriority) return false
      return true
    })
  }, [allTasks, search, fDeveloper, fStatus, fPriority, projectKey])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.dueDate) continue
      const key = t.dueDate.slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  const dueTasks = (date: Date) => tasksByDate.get(format(date, 'yyyy-MM-dd')) ?? []

  // Reschedule via drag & drop
  const { mutate: reschedule } = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string }) =>
      tasksApi.update(projectId, id, { dueDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Đã cập nhật hạn task')
    },
    onError: () => toast.error('Cập nhật hạn thất bại'),
  })

  const handleDrop = (date: Date, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverKey(null)
    const id = e.dataTransfer.getData('text/task-id')
    if (!id) return
    const newDate = format(date, 'yyyy-MM-dd')
    const task = allTasks.find((t) => t.id === id)
    if (task && task.dueDate?.slice(0, 10) === newDate) return
    reschedule({ id, dueDate: newDate })
  }

  // Grid days
  const gridDays = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    }
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentDate, view])

  const goPrev = () => setCurrentDate((d) => (view === 'week' ? subWeeks(d, 1) : subMonths(d, 1)))
  const goNext = () => setCurrentDate((d) => (view === 'week' ? addWeeks(d, 1) : addMonths(d, 1)))

  const headerLabel = view === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM', { locale: vi })} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: vi })}`
    : format(currentDate, 'MMMM yyyy', { locale: vi })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-fg">Calendar</h1>
            <p className="text-xs text-fg-muted mt-0.5">Manage and track tasks based on due dates.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['month', 'week', 'agenda'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    view === v ? 'bg-accent text-white' : 'text-fg-muted hover:bg-bg-subtle',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" onClick={() => setCreateDay(selectedDay ?? new Date())}>
              <Plus className="w-4 h-4" /> Create Task
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
            <h2 className="text-sm font-semibold text-fg min-w-44 text-center">{headerLabel}</h2>
            <Button variant="ghost" size="icon" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-8 w-44 rounded-lg border border-border bg-bg-elevated pl-8 pr-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <FilterSelect value={fDeveloper} onChange={setFDeveloper} placeholder="Developer"
              options={members.map((m) => ({ value: m.userId, label: m.user.fullName }))} />
            <FilterSelect value={fStatus} onChange={setFStatus} placeholder="Status" options={STATUS_OPTS} />
            <FilterSelect value={fPriority} onChange={setFPriority} placeholder="Priority" options={PRIORITY_OPTS} />
          </div>
        </div>
      </div>

      {/* Body */}
      {view === 'agenda' ? (
        <AgendaView
          tasks={tasks} loading={isLoading} projectKey={projectKey}
          timezone={timezone}
          onOpen={(id) => setOpenTaskId(id)}
        />
      ) : (
        <div className="flex-1 overflow-auto scrollbar-thin p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-fg-subtle py-2">{d}</div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {[...Array(view === 'week' ? 7 : 35)].map((_, i) => (
                <Skeleton key={i} className={view === 'week' ? 'h-96' : 'h-40'} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((day) => {
                const dayTasks = dueTasks(day)
                const isToday = dfIsToday(day)
                const inMonth = view === 'week' || isSameMonth(day, currentDate)
                const isSelected = selectedDay && isSameDay(day, selectedDay)
                const key = format(day, 'yyyy-MM-dd')
                const maxShow = view === 'week' ? 8 : 3

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(key) }}
                    onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                    onDrop={(e) => handleDrop(day, e)}
                    className={cn(
                      'rounded-lg border p-1.5 overflow-hidden transition-colors cursor-pointer',
                      view === 'week' ? 'min-h-[400px]' : 'min-h-[140px]',
                      inMonth ? 'border-border bg-bg-elevated' : 'border-transparent bg-transparent opacity-50',
                      isToday && 'bg-info/10 border-info/40',
                      isSelected && 'ring-2 ring-accent border-accent',
                      dragOverKey === key && 'ring-2 ring-accent/60 bg-accent/5',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        isToday ? 'bg-info text-white' : inMonth ? 'text-fg' : 'text-fg-subtle',
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayTasks.slice(0, maxShow).map((t) => (
                        <CalendarTaskCard
                          key={t.id} task={t} projectKey={projectKey}
                          onOpen={() => setOpenTaskId(t.id)}
                        />
                      ))}
                      {dayTasks.length > maxShow && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDayModal(day) }}
                          className="w-full text-left text-xs text-accent hover:underline pl-1"
                        >
                          +{dayTasks.length - maxShow} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Day overflow modal */}
      {dayModal && (
        <Modal open onClose={() => setDayModal(null)}
          title={formatZonedDate(format(dayModal, 'yyyy-MM-dd'), timezone, 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} size="sm">
          <div className="p-4 space-y-1.5 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {dueTasks(dayModal).map((t) => (
              <CalendarTaskCard
                key={t.id} task={t} projectKey={projectKey}
                onOpen={() => { setOpenTaskId(t.id); setDayModal(null) }}
              />
            ))}
          </div>
        </Modal>
      )}

      {/* Create task */}
      {createDay && (
        <CreateTaskModal
          projectId={projectId} dueDate={format(createDay, 'yyyy-MM-dd')}
          members={members} onClose={() => setCreateDay(null)}
        />
      )}

      {/* Detail */}
      <TaskDetailModal
        task={null}
        taskId={openTaskId}
        projectId={projectId}
        projectKey={projectKey}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onOpenTask={(id) => setOpenTaskId(id)}
      />
    </div>
  )
}

// ─── Task card ──────────────────────────────────────────────────────────────

function CalendarTaskCard({ task, projectKey, onOpen }: {
  task: Task; projectKey: string; onOpen: () => void
}) {
  const style = STATUS_STYLE[task.status] ?? STATUS_STYLE.todo
  const tip = [
    `${projectKey}-${task.taskNumber} · ${task.title}`,
    `Status: ${style.label}`,
    `Priority: ${task.priority}`,
    task.assignee ? `Assignee: ${task.assignee.fullName}` : 'Unassigned',
    task.loggedHours ? `Logged: ${task.loggedHours}h` : null,
  ].filter(Boolean).join('\n')

  return (
    <button
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/task-id', task.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      title={tip}
      className="group flex w-full items-center gap-1.5 rounded px-1.5 h-8 bg-bg hover:bg-bg-subtle border-l-2 transition-colors"
      style={{ borderLeftColor: style.bar }}
    >
      <img src={PRIORITY_ICON[task.priority] ?? PRIORITY_ICON.medium} alt="" width={12} height={12} className="shrink-0" />
      <span className="text-[11px] font-medium text-fg-subtle shrink-0">{projectKey}-{task.taskNumber}</span>
      <span className="text-[11px] text-fg truncate flex-1 text-left">{task.title}</span>
      {task.assignee && <Avatar name={task.assignee.fullName} avatarUrl={task.assignee.avatarUrl} size="xs" />}
    </button>
  )
}

// ─── Agenda view ────────────────────────────────────────────────────────────

function AgendaView({ tasks, loading, projectKey, timezone, onOpen }: {
  tasks: Task[]; loading: boolean; projectKey: string; timezone: UserTimezone; onOpen: (id: string) => void
}) {
  const groups = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcoming = tasks
      .filter((t) => t.dueDate && isAfter(parseISO(t.dueDate.slice(0, 10)), new Date(today.getTime() - 1)))
      .sort((a, b) => compareAsc(parseISO(a.dueDate!.slice(0, 10)), parseISO(b.dueDate!.slice(0, 10))))
    const map = new Map<string, Task[]>()
    for (const t of upcoming) {
      const key = t.dueDate!.slice(0, 10)
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [tasks])

  if (loading) {
    return (
      <div className="flex-1 overflow-auto scrollbar-thin p-6 space-y-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    )
  }
  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState title="No upcoming tasks" description="Tasks with due dates will appear here." />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-thin p-6 space-y-6">
      {groups.map(([date, items]) => (
        <div key={date}>
          <p className="text-sm font-semibold text-fg mb-2">
            {formatZonedDate(date, timezone, 'vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            <span className="ml-2 text-xs font-normal text-fg-subtle">{items.length} tasks</span>
          </p>
          <div className="space-y-1.5">
            {items.map((t) => (
              <CalendarTaskCard key={t.id} task={t} projectKey={projectKey} onOpen={() => onOpen(t.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter select ──────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-8 rounded-lg border bg-bg-elevated px-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent',
        value ? 'border-accent text-fg' : 'border-border text-fg-muted',
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Create task modal ──────────────────────────────────────────────────────

function CreateTaskModal({ projectId, dueDate, members, onClose }: {
  projectId: string; dueDate: string
  members: { userId: string; user: { fullName: string } }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: columns = [] } = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId),
    enabled: !!projectId,
  })
  const { register, handleSubmit, control, formState: { errors } } =
    useForm<CreateTaskDto>({ defaultValues: { priority: 'medium', type: 'task', dueDate } })

  const { mutate, isPending } = useMutation({
    mutationFn: (dto: CreateTaskDto) => tasksApi.create(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task đã được tạo')
      onClose()
    },
    onError: () => toast.error('Tạo task thất bại'),
  })

  const submit = handleSubmit((d) => {
    const columnId = columns[0]?.id
    if (!columnId) { toast.error('Project chưa có cột nào'); return }
    mutate({ ...d, columnId, dueDate, assigneeId: d.assigneeId || undefined })
  })

  return (
    <Modal open onClose={onClose} title="Create Task" size="sm">
      <form onSubmit={submit} className="p-5 space-y-4">
        <Input
          {...register('title', { required: 'Nhập tiêu đề task' })}
          label="Tiêu đề *" placeholder="VD: Homepage redesign"
          error={errors.title?.message} autoFocus
        />
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <X className="w-3.5 h-3.5 invisible" />
          <span>Hạn: <span className="font-medium text-fg">{dueDate}</span></span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Priority</span>
            <select {...register('priority')} className="h-9 rounded-lg border border-border bg-bg-elevated px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent">
              {PRIORITY_OPTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Assignee</span>
            <Controller name="assigneeId" control={control} render={({ field }) => (
              <select {...field} value={field.value ?? ''} className="h-9 rounded-lg border border-border bg-bg-elevated px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.fullName}</option>)}
              </select>
            )} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" loading={isPending}>
            <Plus className="w-4 h-4" /> Tạo task
          </Button>
        </div>
      </form>
    </Modal>
  )
}
