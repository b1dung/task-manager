import { useEffect, useState } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Check } from 'lucide-react'
import type { BoardColumn } from '@/api/columns'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

function SortableChip({ col, count }: { col: BoardColumn; count: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-bg-elevated px-3 py-2.5 select-none cursor-grab active:cursor-grabbing shrink-0 w-44',
        isDragging ? 'opacity-60 border-accent ring-2 ring-accent shadow-app-md' : 'border-border hover:border-accent/50',
      )}
    >
      <GripVertical className="w-4 h-4 text-fg-subtle shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg truncate">{col.name}</p>
        <p className="text-xs text-fg-subtle">{count} task</p>
      </div>
    </div>
  )
}

export function ColumnReorder({
  columns, taskCount, onReorder, onDone,
}: {
  columns: BoardColumn[]
  taskCount: (columnId: string) => number
  onReorder: (orderedIds: string[]) => void
  onDone: () => void
}) {
  const [items, setItems] = useState(columns)
  useEffect(() => { setItems(columns) }, [columns])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((c) => c.id === active.id)
    const newIndex = items.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    onReorder(next.map((c) => c.id))
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5 mb-3 shrink-0">
        <p className="text-sm text-fg">
          <span className="font-medium">Chế độ sắp xếp cột</span> — kéo các cột để đổi vị trí.
        </p>
        <Button variant="primary" size="sm" onClick={onDone}><Check className="w-4 h-4" /> Xong</Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
        <SortableContext items={items.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-4">
            {items.map((c) => <SortableChip key={c.id} col={c} count={taskCount(c.id)} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
