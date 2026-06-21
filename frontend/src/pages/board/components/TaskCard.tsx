import {useState, useRef, useEffect} from 'react'
import {useTranslation} from 'react-i18next'
import {createPortal} from 'react-dom'
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {Calendar, ChevronRight, ChevronDown, Check} from 'lucide-react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import type {Task, SubtaskPreview} from '@/api/tasks'
import {tasksApi} from '@/api/tasks'
import {membersApi} from '@/api/members'
import {Avatar} from '@/components/ui'
import { TaskIcon, SubtaskIcon } from '@/components/ui/TaskIcons'
import {useToast} from '@/hooks/useToast'
import {useTaskStore} from '@/stores/useTaskStore'
import {useAuthStore} from '@/stores/useAuthStore'
import {cn, formatDate} from '@/lib/utils'
import {DEFAULT_TIMEZONE} from '@/lib/timezones'

// ─── Priority icon ────────────────────────────────────────────────────────────

const PRIORITY_ICON: Record<string, { svg: string; label: string }> = {
    urgent: {svg: '/priority/highest_new.svg', label: 'Urgent'},
    high:   {svg: '/priority/high_new.svg',    label: 'High'},
    medium: {svg: '/priority/medium_new.svg',  label: 'Medium'},
    low:    {svg: '/priority/low_new.svg',     label: 'Low'},
    lowest: {svg: '/priority/lowest_new.svg',  label: 'Lowest'},
}

function PriorityIcon({priority}: { priority: string }) {
    const cfg = PRIORITY_ICON[priority] ?? PRIORITY_ICON.medium
    return (
        <img src={cfg.svg} alt={cfg.label} title={cfg.label} width={14} height={14} className="shrink-0"/>
    )
}

// ─── Label chip ───────────────────────────────────────────────────────────────

function LabelChip({label}: { label: { id: string; name: string; color: string } }) {
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium truncate max-w-[80px]"
            style={{
                backgroundColor: label.color + '33',
                color: label.color,
                border: `1px solid ${label.color}55`,
            }}
            title={label.name}
        >
      {label.name}
    </span>
    )
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    todo: {label: 'Todo', cls: 'text-fg-muted bg-bg-subtle border-border'},
    in_progress: {label: 'Progress', cls: 'text-info bg-info/10 border-info/30'},
    in_review: {label: 'Review', cls: 'text-warning bg-warning/10 border-warning/30'},
    done: {label: 'Done', cls: 'text-success bg-success/10 border-success/30'},
}

const DEFAULT_AVATAR = 'https://jira.mintoku.vn/assets/images/default-avatar.jpg'

// ─── Subtask assignee picker ──────────────────────────────────────────────────

function SubtaskAssigneePicker({subtask, projectId}: { subtask: SubtaskPreview; projectId: string }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [dropPos, setDropPos] = useState({top: 0, left: 0, flipUp: false})
    const btnRef = useRef<HTMLButtonElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)
    const qc = useQueryClient()

    const {data: members = []} = useQuery({
        queryKey: ['members', projectId],
        queryFn: () => membersApi.list(projectId),
        staleTime: 5 * 60_000,
    })

    const {mutate: changeAssignee} = useMutation({
        mutationFn: (assigneeId: string | null) =>
            tasksApi.update(projectId, subtask.id, {assigneeId}),
        onSuccess: () => qc.invalidateQueries({queryKey: ['tasks', projectId]}),
    })

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!btnRef.current) return
        const rect = btnRef.current.getBoundingClientRect()
        const dropHeight = 220
        const flipUp = window.innerHeight - rect.bottom < dropHeight && rect.top > dropHeight
        setDropPos({
            top: flipUp ? rect.top - dropHeight - 4 : rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - 192 - 8),
            flipUp,
        })
        setOpen((v) => !v)
    }

    useEffect(() => {
        if (!open) return
        const fn = (e: MouseEvent) => {
            if (!dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
                setOpen(false)
        }
        document.addEventListener('mousedown', fn)
        return () => document.removeEventListener('mousedown', fn)
    }, [open])

    useEffect(() => {
        if (!open) return
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', fn)
        return () => document.removeEventListener('keydown', fn)
    }, [open])

    const select = (e: React.MouseEvent, assigneeId: string | null) => {
        e.stopPropagation()
        changeAssignee(assigneeId)
        setOpen(false)
    }

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                onPointerDown={(e) => e.stopPropagation()}
                style={{width: 25, height: 25}}
                className={cn(
                    'shrink-0 rounded-full transition-all ring-offset-bg-surface overflow-hidden',
                    'hover:ring-2 hover:ring-accent/60 hover:ring-offset-1',
                    open && 'ring-2 ring-accent/60 ring-offset-1',
                )}
                title={subtask.assignee ? t('board.changeAssignee', { name: subtask.assignee.fullName }) : t('board.assignAssignee')}
            >
                {subtask.assignee ? (
                    <Avatar name={subtask.assignee.fullName} avatarUrl={subtask.assignee.avatarUrl} size="xs"
                            className="!w-full !h-full !flex"/>
                ) : (
                    <img src={DEFAULT_AVATAR} alt={t('board.assignAssignee')} className="w-full h-full object-cover"/>
                )}
            </button>

            {open && createPortal(
                <div
                    ref={dropRef}
                    style={{position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999}}
                    className="w-48 overflow-hidden rounded-xl border border-border bg-bg-surface shadow-app-md"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {subtask.assignee && (
                        <>
                            <button
                                onClick={(e) => select(e, null)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle transition-colors"
                            >
                                <span
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-fg-subtle text-[10px]">✕</span>
                                {t('board.unassign')}
                            </button>
                            <div className="h-px bg-border mx-2"/>
                        </>
                    )}
                    {members.map((m) => (
                        <button
                            key={m.userId}
                            onClick={(e) => select(e, m.userId)}
                            className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-bg-subtle transition-colors',
                                m.userId === subtask.assigneeId ? 'text-accent' : 'text-fg',
                            )}
                        >
                            <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="xs"/>
                            <span className="flex-1 truncate text-left">{m.user.fullName}</span>
                            {m.userId === subtask.assigneeId && <Check className="h-3 w-3 shrink-0"/>}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    )
}

// ─── Subtask row ──────────────────────────────────────────────────────────────

function SubtaskRow({
                        subtask,
                        projectId,
                        projectKey,
                        onClickName,
                    }: {
    subtask: SubtaskPreview
    projectId: string
    projectKey: string
    onClickName: (id: string) => void
}) {
    const sc = STATUS_CFG[subtask.status] ?? STATUS_CFG.todo

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClickName(subtask.id)
            }}
            className="flex w-full flex-col gap-0.5 px-2.5 py-2 hover:bg-bg-subtle transition-colors cursor-pointer group border-b border-border/50 last:border-b-0"
        >
            {/* Row 1: title */}
            <span
                className={cn(
                    'w-full text-[12px] font-medium break-words transition-colors group-hover:text-accent',
                    subtask.status === 'done' ? 'line-through text-fg-subtle' : 'text-fg',
                )}
            >
        {subtask.title}
      </span>

            {/* Row 2: icon + task id | status + assignee */}
            <div className="flex items-center gap-1.5">
                <SubtaskIcon size={12} />
                {subtask.taskNumber != null && (
                    <span className="text-[10px] font-mono text-fg-subtle shrink-0">
                        {projectKey}-{subtask.taskNumber}
                    </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
          <span className={cn('shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border', sc.cls)}>
            {sc.label}
          </span>
                    <SubtaskAssigneePicker subtask={subtask} projectId={projectId}/>
                </div>
            </div>
        </div>
    )
}

// ─── Subtask badge (done/total + chevron) ─────────────────────────────────────

function SubtaskBadge({
                          done,
                          total,
                          isExpanded,
                          onClick,
                      }: {
    done: number
    total: number
    isExpanded: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick()
            }}
            style={{ height: 25 }}
            className={cn(
                'inline-flex items-center gap-1 px-2 rounded text-[11px] font-medium transition-colors w-auto',
                'border border-border hover:border-accent/50 hover:bg-accent/5',
                isExpanded ? 'text-accent border-accent/40 bg-accent/5' : 'text-fg-subtle bg-bg-subtle',
            )}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" role="presentation" className="shrink-0">
                <g fill="currentColor">
                    <path d="M19 7c1.105.003 2 .899 2 2.006v9.988A2.005 2.005 0 0118.994 21H9.006A2.005 2.005 0 017 19h11c.555 0 1-.448 1-1V7zM3 5.006C3 3.898 3.897 3 5.006 3h9.988C16.102 3 17 3.897 17 5.006v9.988A2.005 2.005 0 0114.994 17H5.006A2.005 2.005 0 013 14.994V5.006zM5 5v10h10V5H5z"/>
                    <path d="M7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L9 10.586 7.707 9.293z"/>
                </g>
            </svg>
            <span>{done}/{total}</span>
            {isExpanded
                ? <ChevronDown size={10} className="shrink-0"/>
                : <ChevronRight size={10} className="shrink-0"/>}
        </button>
    )
}

// ─── Assignee picker ──────────────────────────────────────────────────────────

function AssigneePicker({task, projectId}: { task: Task; projectId: string }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [dropPos, setDropPos] = useState({top: 0, left: 0, flipUp: false})
    const btnRef = useRef<HTMLButtonElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)
    const qc = useQueryClient()
    const toast = useToast()
    const updateTaskStore = useTaskStore((s) => s.updateTask)

    const {data: members = []} = useQuery({
        queryKey: ['members', projectId],
        queryFn: () => membersApi.list(projectId),
        staleTime: 5 * 60_000,
    })

    const {mutate: changeAssignee} = useMutation({
        mutationFn: (assigneeId: string | null) =>
            tasksApi.update(projectId, task.id, {assigneeId}),
        onMutate: (assigneeId) => {
            const member = members.find((m) => m.userId === assigneeId)
            // Optimistic update: store + React Query cache
            updateTaskStore(task.id, {assigneeId, assignee: member?.user ?? null})
            qc.setQueriesData(
                {queryKey: ['tasks', projectId]},
                (old: { data: Task[]; meta: unknown } | undefined) => {
                    if (!old) return old
                    return {
                        ...old,
                        data: old.data.map((t) =>
                            t.id === task.id
                                ? {...t, assigneeId, assignee: member?.user ?? null}
                                : t,
                        ),
                    }
                },
            )
        },
        onError: () => {
            toast.error(t('board.updateAssigneeFailed'))
            qc.invalidateQueries({queryKey: ['tasks', projectId]})
        },
        onSuccess: (updatedTask) => {
            // Confirm with server response (includes full assignee object)
            updateTaskStore(updatedTask.id, updatedTask)
            qc.invalidateQueries({queryKey: ['tasks', projectId]})
        },
    })

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!btnRef.current) return
        const rect = btnRef.current.getBoundingClientRect()
        const dropHeight = 240
        const spaceBelow = window.innerHeight - rect.bottom
        const flipUp = spaceBelow < dropHeight && rect.top > dropHeight
        setDropPos({
            top: flipUp ? rect.top - dropHeight - 4 : rect.bottom + 4,
            left: Math.min(rect.left, window.innerWidth - 192 - 8),
            flipUp,
        })
        setOpen((v) => !v)
    }

    useEffect(() => {
        if (!open) return
        const fn = (e: MouseEvent) => {
            if (
                !dropRef.current?.contains(e.target as Node) &&
                !btnRef.current?.contains(e.target as Node)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', fn)
        return () => document.removeEventListener('mousedown', fn)
    }, [open])

    useEffect(() => {
        if (!open) return
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', fn)
        return () => document.removeEventListener('keydown', fn)
    }, [open])

    const select = (e: React.MouseEvent, assigneeId: string | null) => {
        e.stopPropagation()
        changeAssignee(assigneeId)
        setOpen(false)
    }

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                onPointerDown={(e) => e.stopPropagation()}
                style={{width: 25, height: 25}}
                className={cn(
                    'shrink-0 rounded-full transition-all ring-offset-bg-elevated overflow-hidden',
                    'hover:ring-2 hover:ring-accent/60 hover:ring-offset-1',
                    open && 'ring-2 ring-accent/60 ring-offset-1',
                )}
                title={task.assignee ? t('board.changeAssignee', { name: task.assignee.fullName }) : t('board.assignAssignee')}
            >
                {task.assignee ? (
                    <Avatar name={task.assignee.fullName} avatarUrl={task.assignee.avatarUrl} size="xs"
                            className="!w-full !h-full !flex"/>
                ) : (
                    <img src={DEFAULT_AVATAR} alt={t('board.assignAssignee')} className="w-full h-full object-cover"/>
                )}
            </button>

            {open && createPortal(
                <div
                    ref={dropRef}
                    style={{position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999}}
                    className="w-48 overflow-hidden rounded-xl border border-border bg-bg-surface shadow-app-md"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {task.assignee && (
                        <>
                            <button
                                onClick={(e) => select(e, null)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-muted hover:bg-bg-subtle transition-colors"
                            >
                                <span
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-fg-subtle text-[10px]">✕</span>
                                {t('board.unassign')}
                            </button>
                            <div className="h-px bg-border mx-2"/>
                        </>
                    )}
                    {members.map((m) => (
                        <button
                            key={m.userId}
                            onClick={(e) => select(e, m.userId)}
                            className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-bg-subtle transition-colors',
                                m.userId === task.assigneeId ? 'text-accent' : 'text-fg',
                            )}
                        >
                            <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="xs"/>
                            <span className="flex-1 truncate text-left">{m.user.fullName}</span>
                            {m.userId === task.assigneeId && (
                                <Check className="h-3 w-3 shrink-0"/>
                            )}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    )
}

// ─── Task card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
    task: Task
    onClick: (task: Task) => void
    onSubtaskClick?: (taskId: string) => void
    isDragging?: boolean
    projectKey?: string
}

export function TaskCard({task, onClick, onSubtaskClick, isDragging, projectKey = 'TASK'}: TaskCardProps) {
    const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
    const [isExpanded, setIsExpanded] = useState(false)
    // Read live task from store — re-renders when assignee or other fields change via socket/mutation
    const liveTask = useTaskStore((s) => s.tasks[task.id]) ?? task

    const {
        setNodeRef, attributes, listeners,
        transform, transition, isDragging: isSortableDragging,
    } = useSortable({id: task.id, data: {task: liveTask, type: 'task'}})

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const isOverdue =
        liveTask.dueDate &&
        liveTask.status !== 'done' &&
        new Date(liveTask.dueDate) < new Date()

    const subtaskCount = liveTask.subtaskCount ?? 0
    const doneCount = liveTask.doneSubtaskCount ?? 0
    const preview = liveTask.subtasksPreview ?? []
    const progressPct = subtaskCount > 0 ? Math.round((doneCount / subtaskCount) * 100) : 0

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, boxShadow: '0 1px 2px rgba(0,0,0,.2)' }}
            {...attributes}
            {...listeners}
            onClick={() => onClick(liveTask)}
            className={cn(
                'flex flex-col gap-1.5 rounded-card border border-border bg-bg-elevated p-3 cursor-pointer',
                'hover:border-border-bright hover:shadow-app-sm transition-all select-none',
                (isSortableDragging || isDragging) && 'opacity-50 ring-2 ring-accent',
            )}
        >
            {/* Title */}
            <p className="text-[14px] font-medium text-fg leading-snug line-clamp-2">
                {liveTask.title}
            </p>

            {/* Labels */}
            {liveTask.labels?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {liveTask.labels.map((l) => (
                        <LabelChip key={l.id} label={l}/>
                    ))}
                </div>
            )}

            {/* Due date */}
            {liveTask.dueDate && (
                <div
                    className={cn(
                        'inline-flex self-start items-center gap-1 text-[13px] rounded-[4px] px-1.5 py-0.5 border',
                        isOverdue ? 'bg-[#FFEBE6] text-[#ae2e24]' : 'bg-white text-[#292a2e]',
                    )}
                    style={{ borderColor: isOverdue ? '#ae2e24' : '#0B120E24' }}
                >
                    {isOverdue && (
                        <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
                            <path fill="currentColor" fillRule="evenodd" d="M5.7 1.383c.996-1.816 3.605-1.817 4.602-.002l5.35 9.73C16.612 12.86 15.346 15 13.35 15H2.667C.67 15-.594 12.862.365 11.113zm3.288.72a1.125 1.125 0 0 0-1.972.002L1.68 11.834c-.41.75.132 1.666.987 1.666H13.35c.855 0 1.398-.917.986-1.667z" clipRule="evenodd"/>
                            <path fill="currentColor" fillRule="evenodd" d="M7.25 9V4h1.5v5z" clipRule="evenodd"/>
                            <path fill="currentColor" d="M9 11.25a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                        </svg>
                    )}
                    <Calendar size={14}/>
                    {formatDate(liveTask.dueDate, timezone)}
                </div>
            )}


            {/* Footer */}
            <div className="flex items-center gap-1.5 mt-auto pt-0.5">
                {/* Task number chip */}
                {liveTask.taskNumber != null && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-fg-subtle bg-bg-subtle rounded px-1.5 py-0.5 shrink-0">
                        <TaskIcon size={11} />
                        {projectKey}-{liveTask.taskNumber}
                    </span>
                )}

                {/* Priority + assignee pushed to right */}
                <div className="ml-auto flex items-center gap-1.5">
                    <PriorityIcon priority={liveTask.priority}/>
                    <AssigneePicker task={liveTask} projectId={liveTask.projectId}/>
                </div>
            </div>

            {/* Subtask badge + list */}
            {subtaskCount > 0 && (
                <div className="mt-[5px] mb-[5px]">
                    <SubtaskBadge
                        done={doneCount}
                        total={subtaskCount}
                        isExpanded={isExpanded}
                        onClick={() => setIsExpanded(!isExpanded)}
                    />

                    {/* Animated list */}
                    <div
                        className="overflow-hidden transition-[max-height] duration-250 ease-in-out"
                        style={{maxHeight: isExpanded ? `${preview.length * 80 + 8}px` : '0px'}}
                    >
                        {/* Progress bar — trên list */}
                        <div className="py-2">
                            <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${progressPct}%`,
                                        backgroundColor: progressPct === 100 ? '#36B37E' : '#2684FF',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-md border border-border/60 bg-bg-surface/60 overflow-hidden">
                            {preview.map((sub) => (
                                <SubtaskRow
                                    key={sub.id}
                                    subtask={sub}
                                    projectId={liveTask.projectId}
                                    projectKey={projectKey}
                                    onClickName={(id) => onSubtaskClick?.(id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

export function TaskCardOverlay({task}: { task: Task }) {
    return (
        <div className="rounded-card border border-accent/60 bg-bg-elevated p-3 shadow-popover rotate-2 w-64">
            <p className="text-[14px] font-medium text-fg line-clamp-2">{task.title}</p>
        </div>
    )
}
