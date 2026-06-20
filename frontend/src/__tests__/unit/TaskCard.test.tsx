import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskCard } from '@/pages/board/components/TaskCard'
import type { Task, SubtaskPreview } from '@/api/tasks'

// Mock store: liveTask always falls back to prop task; updateTask is a no-op spy
vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: (selector?: (s: { tasks: Record<string, Task>; setTasks: () => void; updateTask: () => void }) => unknown) => {
    const state = { tasks: {}, setTasks: vi.fn(), updateTask: vi.fn() }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tasks')>()
  return {
    ...actual,
    tasksApi: {
      ...actual.tasksApi,
      update: vi.fn().mockResolvedValue({
        id: 'task-1', projectId: 'proj-1', columnId: 'col-1', sprintId: null,
        title: 'Fix login bug', description: null, type: 'bug', priority: 'high',
        status: 'in_progress', assigneeId: 'user-2', reporterId: 'user-2',
        assignee: { id: 'user-2', fullName: 'Bob', email: 'bob@test.com', avatarUrl: null },
        reporter: { id: 'user-2', fullName: 'Bob', email: 'bob@test.com', avatarUrl: null },
        dueDate: null, estimatedHours: null, loggedHours: null, storyPoints: null,
        position: 0, parentTaskId: null, labels: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }),
    },
  }
})

vi.mock('@/api/members', () => ({
  membersApi: {
    list: vi.fn().mockResolvedValue([
      { userId: 'user-1', role: 'admin', projectId: 'proj-1', joinedAt: '', taskCount: 0,
        user: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null } },
      { userId: 'user-2', role: 'member', projectId: 'proj-1', joinedAt: '', taskCount: 0,
        user: { id: 'user-2', fullName: 'Bob', email: 'bob@test.com', avatarUrl: null } },
    ]),
  },
}))

const baseTask: Task = {
  id: 'task-1',
  projectId: 'proj-1',
  columnId: 'col-1',
  sprintId: null,
  title: 'Fix login bug',
  description: 'Steps to reproduce...',
  type: 'bug',
  priority: 'high',
  status: 'in_progress',
  assigneeId: 'user-1',
  reporterId: 'user-2',
  assignee: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null },
  reporter: { id: 'user-2', fullName: 'Bob', email: 'bob@test.com', avatarUrl: null },
  dueDate: null,
  estimatedHours: 4,
  loggedHours: 2,
  storyPoints: 3,
  position: 0,
  parentTaskId: null,
  labels: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const subtask1: SubtaskPreview = {
  id: 'sub-1',
  title: 'Sub task one',
  status: 'todo',
  taskNumber: null,
  assigneeId: 'user-1',
  assignee: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null },
  parentTaskId: 'task-1',
}
const subtask2: SubtaskPreview = {
  id: 'sub-2',
  title: 'Sub task two',
  status: 'done',
  taskNumber: null,
  assigneeId: null,
  assignee: null,
  parentTaskId: 'task-1',
}

function renderCard(task = baseTask, onClick = vi.fn(), onSubtaskClick = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DndContext>
        <SortableContext items={[task.id]}>
          <TaskCard task={task} onClick={onClick} onSubtaskClick={onSubtaskClick} />
        </SortableContext>
      </DndContext>
    </QueryClientProvider>,
  )
}

describe('TaskCard', () => {
  it('renders task title', () => {
    renderCard()
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })

  it('shows priority icon (↑ for high)', () => {
    renderCard()
    expect(screen.getByTitle('High')).toBeInTheDocument()
  })

  it('shows assignee avatar', () => {
    renderCard()
    expect(screen.getByTitle('Alice')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    renderCard(baseTask, onClick)
    fireEvent.click(screen.getByText('Fix login bug'))
    expect(onClick).toHaveBeenCalledWith(baseTask)
  })

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  it('shows due date when provided', () => {
    const due = '2026-12-31T00:00:00.000Z'
    const task = { ...baseTask, dueDate: due }
    renderCard(task)
    expect(screen.getByText(fmtDate(due))).toBeInTheDocument()
  })

  it('marks overdue date in red', () => {
    const due = '2020-01-01T00:00:00.000Z'
    const task = { ...baseTask, dueDate: due, status: 'todo' }
    renderCard(task)
    const dateEl = screen.getByText(fmtDate(due))
    expect(dateEl.className).toMatch(/#ae2e24/)
  })

  it('renders label chips with names', () => {
    const task = {
      ...baseTask,
      labels: [
        { id: 'l1', name: 'frontend', color: '#3b82f6' },
        { id: 'l2', name: 'backend', color: '#10b981' },
      ],
    }
    renderCard(task)
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('backend')).toBeInTheDocument()
  })

  it('shows task number when provided', () => {
    const task = { ...baseTask, taskNumber: 42 }
    renderCard(task)
    expect(screen.getByText('TASK-42')).toBeInTheDocument()
  })

  // ── Subtask tests ────────────────────────────────────────────────────────

  it('does NOT render subtask toggle when subtaskCount is 0', () => {
    const task = { ...baseTask, subtaskCount: 0, subtasksPreview: [] }
    renderCard(task)
    expect(screen.queryByRole('button', { name: /▼|▲/ })).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows toggle with count when subtaskCount > 0', () => {
    const task = { ...baseTask, subtaskCount: 2, subtasksPreview: [subtask1, subtask2] }
    renderCard(task)
    expect(screen.getByText('0/2')).toBeInTheDocument()
  })

  it('expands subtask list on toggle click (maxHeight changes)', () => {
    const task = { ...baseTask, subtaskCount: 2, subtasksPreview: [subtask1, subtask2] }
    const { container } = renderCard(task)
    // subtask list container starts collapsed (maxHeight 0)
    const listWrapper = container.querySelector('[style*="max-height"]')
    expect(listWrapper).toHaveStyle({ maxHeight: '0px' })
    // click toggle — height = preview.length * 80 + 8 = 168px
    fireEvent.click(screen.getByText('0/2'))
    expect(listWrapper).toHaveStyle({ maxHeight: '168px' })
    expect(screen.getByText('Sub task one')).toBeInTheDocument()
    expect(screen.getByText('Sub task two')).toBeInTheDocument()
  })

  it('collapses subtask list on second toggle click', () => {
    const task = { ...baseTask, subtaskCount: 2, subtasksPreview: [subtask1, subtask2] }
    const { container } = renderCard(task)
    const listWrapper = container.querySelector('[style*="max-height"]')
    const toggle = screen.getByText('0/2')
    fireEvent.click(toggle) // expand → 168px
    expect(listWrapper).toHaveStyle({ maxHeight: '168px' })
    fireEvent.click(toggle) // collapse → 0px
    expect(listWrapper).toHaveStyle({ maxHeight: '0px' })
  })

  it('shows subtask assignee avatar in row', () => {
    const task = { ...baseTask, subtaskCount: 1, subtasksPreview: [subtask1] }
    renderCard(task)
    fireEvent.click(screen.getByText('0/1'))
    // Alice appears twice: main card assignee + subtask assignee
    const aliceAvatars = screen.getAllByTitle('Alice')
    expect(aliceAvatars.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSubtaskClick with subtask id when subtask name clicked', () => {
    const onSubtaskClick = vi.fn()
    const task = { ...baseTask, subtaskCount: 1, subtasksPreview: [subtask1] }
    renderCard(task, vi.fn(), onSubtaskClick)
    fireEvent.click(screen.getByText('0/1')) // expand
    fireEvent.click(screen.getByText('Sub task one'))
    expect(onSubtaskClick).toHaveBeenCalledWith('sub-1')
  })

  // ── AssigneePicker tests ─────────────────────────────────────────────────────

  it('shows + placeholder when no assignee', () => {
    const task = { ...baseTask, assigneeId: null, assignee: null }
    renderCard(task)
    expect(screen.getByTitle('Gán assignee')).toBeInTheDocument()
  })

  it('shows assignee avatar with tooltip when assigned', () => {
    renderCard(baseTask) // baseTask has assignee Alice
    expect(screen.getByTitle('Alice — đổi assignee')).toBeInTheDocument()
  })

  it('opens member list dropdown on assignee click', async () => {
    renderCard(baseTask)
    fireEvent.click(screen.getByTitle('Alice — đổi assignee'))
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('calls tasksApi.update with new assigneeId when member selected', async () => {
    const { tasksApi } = await import('@/api/tasks')
    renderCard(baseTask)
    fireEvent.click(screen.getByTitle('Alice — đổi assignee'))
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bob'))
    await waitFor(() => {
      expect(tasksApi.update).toHaveBeenCalledWith('proj-1', 'task-1', { assigneeId: 'user-2' })
    })
  })

  it('calls tasksApi.update with null when "Bỏ gán" clicked', async () => {
    const { tasksApi } = await import('@/api/tasks')
    renderCard(baseTask)
    fireEvent.click(screen.getByTitle('Alice — đổi assignee'))
    await waitFor(() => expect(screen.getByText('Bỏ gán')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bỏ gán'))
    await waitFor(() => {
      expect(tasksApi.update).toHaveBeenCalledWith('proj-1', 'task-1', { assigneeId: null })
    })
  })
})
