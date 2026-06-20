import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay,
  PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  pointerWithin, closestCenter,
  type CollisionDetection,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Menu } from 'lucide-react'
import { columnsApi, type BoardColumn } from '@/api/columns'
import { tasksApi, type Task, type CreateTaskDto } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { useFilterStore } from '@/stores/useFilterStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { useSocket } from '@/hooks/useSocket'
import { useToast } from '@/hooks/useToast'
import { Button, Modal, Input } from '@/components/ui'
import { useForm, Controller } from 'react-hook-form'
import { BoardColumnView, AddColumnCard } from './components/BoardColumnView'
import { ColumnReorder } from './components/ColumnReorder'
import { TaskCardOverlay } from './components/TaskCard'
import { TaskDetailModal } from './components/TaskDetailModal'
import { FilterBar } from './components/FilterBar'
import { usePermissions } from '@/hooks/usePermissions'

// Board collision: pointer-within matches sorted by rect area (tasks < columns), fallback to closestCenter
const boardCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    // Prefer the smallest container (task card beats column div)
    return [...hits].sort((a, b) => {
      const rA = args.droppableRects.get(a.id)
      const rB = args.droppableRects.get(b.id)
      if (!rA || !rB) return 0
      return rA.width * rA.height - rB.width * rB.height
    })
  }
  return closestCenter(args)
}

function getProjectKey(name?: string | null): string {
  const words = (name ?? '').trim().split(/[\s\-_]+/).filter(Boolean)
  if (words.length >= 2) return words.map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 5)
  return (words[0] ?? 'TASK').slice(0, 5).toUpperCase()
}

function columnNameToStatus(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('done') || n.includes('complete') || n.includes('closed')) return 'done'
  if (n.includes('review') || n.includes('testing') || n.includes('qa')) return 'in_review'
  if (n.includes('progress') || n.includes('doing') || n.includes('active') || n.includes('wip')) return 'in_progress'
  return 'todo'
}

export function BoardPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const toast = useToast()
  const socket = useSocket(projectId)
  const { board: filters } = useFilterStore()
  const { setTasks, updateTask: updateTaskStore } = useTaskStore()
  const permissions = usePermissions()
  const canCreateTask = permissions.includes('create_task')
  const canEditBoard = permissions.includes('edit_project')
  const canUpdateTask = permissions.includes('update_own_task')

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    () => searchParams.get('selectedIssue'),
  )
  const [addingToColumn, setAddingToColumn] = useState<BoardColumn | null>(null)
  const [reorderMode, setReorderMode] = useState(false)
  // Fallback for tasks not in allTasks (e.g. subtasks opened from card preview)
  const [selectedTaskFallback, setSelectedTaskFallback] = useState<Task | null>(null)

  // Snapshot before drag for rollback
  const preSnapshotRef = useRef<typeof tasksResult | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
  })
  const projectKey = project ? getProjectKey(project.name) : 'TASK'

  const { data: columns = [] } = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId),
    enabled: !!projectId,
  })

  const { data: tasksResult, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId, filters],
    queryFn: () => tasksApi.list(projectId, { ...filters, limit: 500, includeSubtasks: false }),
    enabled: !!projectId,
  })
  const allTasks = useMemo(() => tasksResult?.data ?? [], [tasksResult?.data])

  // Sync React Query tasks to Zustand store so TaskCard/TaskDetailModal can subscribe
  useEffect(() => {
    if (allTasks.length) setTasks(allTasks)
  }, [allTasks, setTasks])

  // Simple stable grouping — never change columns mid-drag
  const tasksByColumn = useCallback(
    (colId: string) => allTasks.filter((t) => t.columnId === colId),
    [allTasks],
  )

  const setIssueParam = useCallback((taskId: string) => {
    setSearchParams((p) => { p.set('selectedIssue', taskId); return p }, { replace: true })
  }, [setSearchParams])

  const clearIssueParam = useCallback(() => {
    setSearchParams((p) => { p.delete('selectedIssue'); return p }, { replace: true })
  }, [setSearchParams])

  // Click handler: keep task as fallback for instant display, but do NOT prime the individual
  // task cache — board task lacks subtasks relation, and staleTime would block the full fetch.
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTaskId(task.id)
    setSelectedTaskFallback(task)
    setIssueParam(task.id)
  }, [setIssueParam])

  // Open a subtask from card preview — not in allTasks, let modal fetch it
  const handleSubtaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
    setSelectedTaskFallback(null)
    setIssueParam(taskId)
  }, [setIssueParam])

  // Navigate to another task from inside the modal (breadcrumb parent click)
  const handleOpenTask = useCallback((taskId: string) => {
    const existing = allTasks.find((t) => t.id === taskId)
    setSelectedTaskFallback(existing ?? null)
    setSelectedTaskId(taskId)
    setIssueParam(taskId)
  }, [allTasks, setIssueParam])

  const handleCloseModal = useCallback(() => {
    setSelectedTaskId(null)
    setSelectedTaskFallback(null)
    clearIssueParam()
  }, [clearIssueParam])

  // Derive modal task from allTasks; fall back to explicitly set task for subtasks
  const modalTask = selectedTaskId
    ? (allTasks.find((t) => t.id === selectedTaskId) ?? selectedTaskFallback)
    : null

  // Socket realtime
  useState(() => {
    if (!socket) return
    const refresh = () => qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    const handleTaskUpdated = (task: Task) => {
      updateTaskStore(task.id, task)
      // Update individual task cache so TaskDetailModal sees new assignee immediately
      qc.setQueryData(['task', projectId, task.id], task)
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    }
    socket.on('task:created', refresh)
    socket.on('task:updated', handleTaskUpdated)
    socket.on('task:moved', refresh)
    socket.on('task:deleted', refresh)
    return () => {
      socket.off('task:created', refresh)
      socket.off('task:updated', handleTaskUpdated)
      socket.off('task:moved', refresh)
      socket.off('task:deleted', refresh)
    }
  })

  const { mutate: addColumn } = useMutation({
    mutationFn: (name: string) => columnsApi.create(projectId, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
    onError: () => toast.error('Tạo column thất bại'),
  })
  const { mutate: editColumn } = useMutation({
    mutationFn: (col: BoardColumn) => columnsApi.update(projectId, col.id, { name: col.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
  })
  const { mutate: deleteColumn } = useMutation({
    mutationFn: (col: BoardColumn) => columnsApi.delete(projectId, col.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['columns', projectId] })
      toast.success('Đã xóa column')
    },
    onError: () => toast.error('Không thể xóa column có task'),
  })

  const { mutate: reorderColumns } = useMutation({
    mutationFn: (orderedIds: string[]) => columnsApi.reorder(projectId, orderedIds),
    onMutate: (orderedIds) => {
      const prev = qc.getQueryData<BoardColumn[]>(['columns', projectId])
      if (prev) {
        const byId = new Map(prev.map((c) => [c.id, c]))
        const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as BoardColumn[]
        qc.setQueryData(['columns', projectId], next)
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['columns', projectId], ctx.prev)
      toast.error('Sắp xếp cột thất bại')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['columns', projectId] }),
  })

  const { mutate: moveTask } = useMutation({
    mutationFn: ({ id, columnId, position }: { id: string; columnId: string; position: number }) =>
      tasksApi.move(projectId, id, { columnId, position }),
    onSuccess: (movedTask) => {
      // Sync individual task cache so popup shows correct status
      qc.setQueryData(['task', projectId, movedTask.id], movedTask)
      // Refresh full list in background to ensure consistency
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
    onError: () => {
      if (preSnapshotRef.current) {
        qc.setQueryData(['tasks', projectId, filters], preSnapshotRef.current)
      }
      toast.error('Di chuyển task thất bại')
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    if (!canUpdateTask) return
    const task = event.active.data.current?.task as Task | undefined
    if (task) {
      setActiveTask(task)
      preSnapshotRef.current = tasksResult ?? null
    }
  }

  const handleDragCancel = () => {
    setActiveTask(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || !canUpdateTask) return

    const dragging = active.data.current?.task as Task
    if (!dragging) return

    const overId = over.id as string

    // Determine target column + position — prefer explicit type tag, fall back to ID lookup
    let targetColumnId = dragging.columnId
    let targetPosition: number

    const overType = over.data.current?.type as string | undefined

    if (overType === 'column' || (!overType && columns.some((c) => c.id === overId))) {
      // Dropped onto column droppable zone
      targetColumnId = overId
      targetPosition = tasksByColumn(targetColumnId).length
    } else if (overType === 'task' || (!overType && allTasks.some((t) => t.id === overId))) {
      // Dropped onto a task card
      const overTask: Task | undefined =
        (over.data.current?.task as Task | undefined) ?? allTasks.find((t) => t.id === overId)
      if (!overTask) return
      targetColumnId = overTask.columnId
      if (dragging.id === overTask.id) return
      const colTasks = allTasks.filter((t) => t.columnId === targetColumnId)
      targetPosition = colTasks.findIndex((t) => t.id === overTask.id)
      if (targetPosition < 0) targetPosition = 0
    } else {
      return
    }

    const targetColumn = columns.find((c) => c.id === targetColumnId)
    const newStatus = targetColumn ? columnNameToStatus(targetColumn.name) : dragging.status

    const updatedTask = { ...dragging, columnId: targetColumnId, position: targetPosition, status: newStatus }

    // Optimistic update — list cache
    qc.setQueryData(['tasks', projectId, filters], (old: typeof tasksResult) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map((t) => (t.id === dragging.id ? updatedTask : t)),
      }
    })

    // Optimistic update — individual task cache (used by TaskDetailModal)
    qc.setQueryData(['task', projectId, dragging.id], updatedTask)

    moveTask({ id: dragging.id, columnId: targetColumnId, position: targetPosition })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden px-4 py-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0"><FilterBar projectId={projectId} /></div>
        {canEditBoard && !reorderMode && (
          <button
            onClick={() => setReorderMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors shrink-0"
            title="Sắp xếp lại cột"
          >
            <Menu className="w-4 h-4" /> Sắp xếp cột
          </button>
        )}
      </div>

      {reorderMode ? (
        <ColumnReorder
          columns={columns}
          taskCount={(id) => tasksByColumn(id).length}
          onReorder={(ids) => reorderColumns(ids)}
          onDone={() => setReorderMode(false)}
        />
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4 flex-1">
          {columns.map((col) => (
            <BoardColumnView
              key={col.id}
              column={col}
              tasks={tasksByColumn(col.id)}
              isLoading={tasksLoading}
              projectKey={projectKey}
              onAddTask={setAddingToColumn}
              onEditColumn={editColumn}
              onDeleteColumn={deleteColumn}
              onTaskClick={handleTaskClick}
              onSubtaskClick={handleSubtaskClick}
              canCreateTask={canCreateTask}
              canEditColumn={canEditBoard}
            />
          ))}
          {canEditBoard && <AddColumnCard onAdd={addColumn} />}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
      )}

      {canCreateTask && <AddTaskModal
        open={!!addingToColumn}
        projectId={projectId}
        column={addingToColumn}
        onClose={() => setAddingToColumn(null)}
      />}

      <TaskDetailModal
        task={modalTask}
        taskId={selectedTaskId}
        projectId={projectId}
        projectKey={projectKey}
        open={!!selectedTaskId}
        onClose={handleCloseModal}
        onOpenTask={handleOpenTask}
      />
    </div>
  )
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', svg: '/priority/highest_new.svg' },
  { value: 'high',   label: 'High',   svg: '/priority/high_new.svg' },
  { value: 'medium', label: 'Medium', svg: '/priority/medium_new.svg' },
  { value: 'low',    label: 'Low',    svg: '/priority/low_new.svg' },
  { value: 'lowest', label: 'Lowest', svg: '/priority/lowest_new.svg' },
]

function AddTaskModal({
  open, projectId, column, onClose,
}: {
  open: boolean; projectId: string; column: BoardColumn | null; onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CreateTaskDto & { title: string }>({ defaultValues: { priority: 'medium', type: 'task' } })

  const { mutate, isPending } = useMutation({
    mutationFn: (dto: CreateTaskDto) => tasksApi.create(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task đã được tạo')
      reset()
      onClose()
    },
    onError: () => toast.error('Tạo task thất bại'),
  })

  if (!column) return null

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={`Thêm task vào "${column.name}"`} size="sm">
      <form
        onSubmit={handleSubmit((d) => mutate({ ...d, columnId: column.id }))}
        className="p-5 space-y-4"
      >
        <Input
          {...register('title', { required: 'Nhập tiêu đề task' })}
          label="Tiêu đề *"
          placeholder="VD: Fix login bug"
          error={errors.title?.message}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg-muted">Priority</span>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <div className="flex gap-1.5 flex-wrap">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => field.onChange(p.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      field.value === p.value
                        ? 'border-accent bg-accent/10 text-fg'
                        : 'border-border text-fg-muted hover:border-border-bright hover:text-fg'
                    }`}
                  >
                    <img src={p.svg} alt={p.label} width={13} height={13} />
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={() => { reset(); onClose() }}>Hủy</Button>
          <Button variant="primary" type="submit" loading={isPending}>
            <Plus className="w-4 h-4" /> Tạo task
          </Button>
        </div>
      </form>
    </Modal>
  )
}
