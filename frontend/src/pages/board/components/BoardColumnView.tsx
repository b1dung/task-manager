import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { BoardColumn } from '@/api/columns'
import type { Task } from '@/api/tasks'
import { Button, Dropdown, TaskCardSkeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { TaskCard } from './TaskCard'

interface BoardColumnViewProps {
  column: BoardColumn
  tasks: Task[]
  isLoading?: boolean
  projectKey: string
  onAddTask: (column: BoardColumn) => void
  onEditColumn: (column: BoardColumn) => void
  onDeleteColumn: (column: BoardColumn) => void
  onTaskClick: (task: Task) => void
  onSubtaskClick?: (taskId: string) => void
  canCreateTask?: boolean
  canEditColumn?: boolean
}

export function BoardColumnView({
  column, tasks, isLoading, projectKey,
  onAddTask, onEditColumn, onDeleteColumn, onTaskClick, onSubtaskClick,
  canCreateTask = false, canEditColumn = false,
}: BoardColumnViewProps) {
  // Only show parent tasks on the board; subtasks are inline inside their parent card
  const visibleTasks = tasks.filter((t) => t.parentTaskId === null)
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { column, type: 'column' } })

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    setEditing(false)
    if (name.trim() && name !== column.name) {
      onEditColumn({ ...column, name: name.trim() })
    } else {
      setName(column.name)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-[338px] shrink-0 rounded-xl border bg-bg-surface transition-colors',
        isOver
          ? 'border-accent/60 bg-accent/5 ring-2 ring-accent/30'
          : 'border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        {column.color && (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        )}

        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setName(column.name); setEditing(false) }
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-fg border-b border-accent outline-none"
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-fg cursor-pointer select-none"
            onDoubleClick={() => canEditColumn && setEditing(true)}
          >
            {column.name}
          </span>
        )}

        <span className="text-xs text-fg-subtle bg-bg-elevated rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {visibleTasks.length}
        </span>

        {canEditColumn && <Dropdown
          align="right"
          trigger={<Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-3.5 h-3.5" /></Button>}
          items={[
            { label: 'Đổi tên', icon: <Pencil className="w-4 h-4" />, onClick: () => setEditing(true) },
            {
              label: 'Xóa column',
              icon: <Trash2 className="w-4 h-4" />,
              onClick: () => onDeleteColumn(column),
              danger: true,
              disabled: tasks.length > 0,  // use full tasks (incl subtasks) to prevent orphan subtasks
            },
          ]}
        />}
      </div>

      {/* Task list */}
      <div className="flex-1 px-2.5 py-2 space-y-2 overflow-y-auto scrollbar-thin min-h-[80px] max-h-[calc(100vh-240px)]">
        <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {isLoading
            ? [...Array(3)].map((_, i) => <TaskCardSkeleton key={i} />)
            : visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projectKey={projectKey}
                  onClick={onTaskClick}
                  onSubtaskClick={onSubtaskClick}
                />
              ))}
        </SortableContext>
      </div>

      {/* Add task button */}
      {canCreateTask && <div className="px-2.5 py-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-fg-subtle hover:text-fg"
          onClick={() => onAddTask(column)}
        >
          <Plus className="w-4 h-4" /> Thêm task
        </Button>
      </div>}
    </div>
  )
}

export function AddColumnCard({ onAdd }: { onAdd: (name: string) => void }) {
  const [active, setActive] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  const commit = () => {
    if (name.trim()) onAdd(name.trim())
    setName('')
    setActive(false)
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex items-center gap-2 w-[338px] shrink-0 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-fg-subtle hover:text-fg hover:border-accent/50 transition-colors"
      >
        <Plus className="w-4 h-4" /> Thêm column
      </button>
    )
  }

  return (
    <div className="w-[338px] shrink-0 rounded-xl border border-border bg-bg-surface p-3 space-y-2">
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setName(''); setActive(false) }
        }}
        placeholder="Tên column..."
        className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={commit} disabled={!name.trim()}>Thêm</Button>
        <Button variant="ghost" size="sm" onClick={() => { setName(''); setActive(false) }}>Hủy</Button>
      </div>
    </div>
  )
}
