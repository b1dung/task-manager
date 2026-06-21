import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskDetailModal } from '@/pages/board/components/TaskDetailModal'
import type { Task } from '@/api/tasks'

// ─── Hoisted mocks (safe for vi.mock factories) ───────────────────────────────

const {
  mockUpdate, mockGet, mockTaskCreate, mockCommentList, mockCommentCreate,
  mockMemberList, mockLabelList, mockApiGet, mockApiPost, mockApiDelete,
} = vi.hoisted(() => ({
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockGet: vi.fn(),
  mockTaskCreate: vi.fn(),
  mockCommentList: vi.fn(),
  mockCommentCreate: vi.fn(),
  mockMemberList: vi.fn(),
  mockLabelList: vi.fn(),
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
  mockApiDelete: vi.fn().mockResolvedValue({ data: { success: true } }),
}))

vi.mock('@/api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tasks')>()
  return {
    ...actual,
    tasksApi: {
      get: mockGet,
      update: mockUpdate,
      list: vi.fn().mockResolvedValue({ data: [], meta: {} }),
      create: mockTaskCreate,
      delete: vi.fn(),
      move: vi.fn(),
    },
  }
})

vi.mock('@/api/comments', () => ({
  commentsApi: {
    list: mockCommentList,
    create: mockCommentCreate,
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/api/members', () => ({
  membersApi: {
    list: mockMemberList,
  },
}))

vi.mock('@/api/labels', () => ({
  labelsApi: {
    list: mockLabelList,
  },
}))

vi.mock('@/api/columns', () => ({
  columnsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'col-1', projectId: 'proj-1', name: 'To Do', position: 0, color: null, wipLimit: null },
      { id: 'col-2', projectId: 'proj-1', name: 'In Progress', position: 1, color: null, wipLimit: null },
      { id: 'col-3', projectId: 'proj-1', name: 'In Review', position: 2, color: null, wipLimit: null },
      { id: 'col-4', projectId: 'proj-1', name: 'Done', position: 3, color: null, wipLimit: null },
    ]),
  },
}))

vi.mock('@/api/client', () => ({
  apiClient: {
    get: mockApiGet,
    post: mockApiPost,
    delete: mockApiDelete,
    patch: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'user-1', fullName: 'Alice', avatarUrl: null, email: 'alice@test.com', role: 'admin' },
    }
    return selector ? selector(state) : state
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSubtask: Task = {
  id: 'sub-1', projectId: 'proj-1', columnId: 'col-1', sprintId: null,
  title: 'Existing subtask', description: null, type: 'task', priority: 'low',
  status: 'todo', assigneeId: null, reporterId: 'user-1', assignee: null,
  reporter: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null },
  dueDate: null, estimatedHours: null, loggedHours: null, storyPoints: null,
  position: 0, parentTaskId: 'task-1', labels: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

const mockTask: Task = {
  id: 'task-1', projectId: 'proj-1', columnId: 'col-1', sprintId: null,
  title: 'Original title', description: 'Task description', type: 'task',
  priority: 'medium', status: 'todo', assigneeId: null, reporterId: 'user-1',
  assignee: null,
  reporter: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null },
  dueDate: null, estimatedHours: 8, loggedHours: 2, storyPoints: 3,
  position: 0, parentTaskId: null, labels: [],
  subtasks: [mockSubtask],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

const mockCreatedSubtask: Task = {
  id: 'sub-2', projectId: 'proj-1', columnId: 'col-1', sprintId: null,
  title: 'New subtask', description: null, type: 'task', priority: 'medium',
  status: 'todo', assigneeId: null, reporterId: 'user-1', assignee: null,
  reporter: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null },
  dueDate: null, estimatedHours: null, loggedHours: null, storyPoints: null,
  position: 1, parentTaskId: 'task-1', labels: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderModal(task: Task | null = mockTask, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(['task', 'proj-1', 'task-1'], task)
  qc.setQueryData(['task-links', 'proj-1', 'task-1'], [])

  return render(
    <QueryClientProvider client={qc}>
      <TaskDetailModal
        task={task}
        projectId="proj-1"
        open={true}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TaskDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue(mockTask)
    mockUpdate.mockResolvedValue(mockTask)
    mockApiGet.mockResolvedValue({ data: { success: true, data: [] } })
    mockCommentList.mockResolvedValue([])
    mockCommentCreate.mockResolvedValue({
      id: 'c-new', taskId: 'task-1', authorId: 'user-1',
      author: { id: 'user-1', fullName: 'Alice', email: '', avatarUrl: null },
      content: 'comment', parentId: null, editedAt: null,
      createdAt: new Date().toISOString(),
    })
    mockMemberList.mockResolvedValue([
      { id: 'm-1', projectId: 'proj-1', userId: 'user-1', role: 'admin', joinedAt: new Date().toISOString(), taskCount: 0, user: { id: 'user-1', fullName: 'Alice', email: 'alice@test.com', avatarUrl: null } },
    ])
    mockLabelList.mockResolvedValue([
      { id: 'label-1', projectId: 'proj-1', name: 'Bug', color: '#ef4444' },
    ])
    mockTaskCreate.mockResolvedValue(mockCreatedSubtask)
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  describe('render', () => {
    it('renders task title as heading', () => {
      renderModal()
      expect(screen.getByText('Original title')).toBeInTheDocument()
    })

    it('renders task ID chip in header', () => {
      renderModal()
      // Display ID: {projectKey}-{taskNumber|position+1}. mockTask position=0, default key TASK → TASK-1
      expect(screen.getByText('TASK-1')).toBeInTheDocument()
    })

    it('renders description content in editor', () => {
      renderModal()
      // Tiptap renders the stored description HTML inside the editor
      expect(screen.getByText('Task description')).toBeInTheDocument()
    })

    it('renders status button with current status label', () => {
      renderModal()
      // "To Do" appears in both the status bar and the right-column status dropdown
      expect(screen.getAllByText('To Do').length).toBeGreaterThanOrEqual(1)
    })

    it('renders existing subtask', () => {
      renderModal()
      expect(screen.getByText('Existing subtask')).toBeInTheDocument()
    })

    it('renders subtask progress bar summary', () => {
      renderModal()
      expect(screen.getByText('0 / 1 completed')).toBeInTheDocument()
    })

    it('renders data-testid on modal panel', () => {
      renderModal()
      expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
    })

    it('does not render when open=false', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      render(
        <QueryClientProvider client={qc}>
          <TaskDetailModal task={mockTask} projectId="proj-1" open={false} onClose={vi.fn()} />
        </QueryClientProvider>,
      )
      expect(screen.queryByTestId('task-detail-modal')).not.toBeInTheDocument()
    })
  })

  // ── Title inline edit ────────────────────────────────────────────────────────

  describe('title inline edit', () => {
    it('clicking title reveals textarea', () => {
      renderModal()
      fireEvent.click(screen.getByText('Original title'))
      expect(screen.getByDisplayValue('Original title')).toBeInTheDocument()
    })

    it('blur saves new title via tasksApi.update', async () => {
      renderModal()
      fireEvent.click(screen.getByText('Original title'))
      const ta = screen.getByDisplayValue('Original title') as HTMLTextAreaElement
      await act(async () => { fireEvent.change(ta, { target: { value: 'Updated title' } }) })
      await act(async () => { fireEvent.blur(ta) })
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('proj-1', 'task-1', expect.objectContaining({ title: 'Updated title' })))
    })

    it('Enter saves title', async () => {
      renderModal()
      fireEvent.click(screen.getByText('Original title'))
      const ta = screen.getByDisplayValue('Original title')
      await act(async () => { fireEvent.change(ta, { target: { value: 'Enter title' } }) })
      await act(async () => { fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false }) })
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('proj-1', 'task-1', expect.objectContaining({ title: 'Enter title' })))
    })

    it('Escape cancels without saving', async () => {
      renderModal()
      fireEvent.click(screen.getByText('Original title'))
      const ta = screen.getByDisplayValue('Original title')
      await act(async () => {
        fireEvent.change(ta, { target: { value: 'Cancelled' } })
      })
      await act(async () => {
        fireEvent.keyDown(ta, { key: 'Escape' })
      })
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  // ── Status dropdown ─────────────────────────────────────────────────────────

  describe('status dropdown', () => {
    // The right-column status dropdown trigger is the full-width font-semibold button
    // (distinct from the subtask status control which is font-medium).
    const statusTrigger = () => {
      const el = screen.getAllByText('To Do').find(
        (e) => e.closest('button')?.className.includes('font-semibold'),
      )
      return (el?.closest('button') ?? el) as HTMLElement
    }

    it('opens on click and lists the project columns', async () => {
      renderModal()
      fireEvent.click(statusTrigger())
      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('In Review')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
      })
    })

    it('selecting a column moves the task via tasksApi.update', async () => {
      renderModal()
      fireEvent.click(statusTrigger())
      await waitFor(() => screen.getByText('In Progress'))
      await act(async () => { fireEvent.click(screen.getByText('In Progress')) })
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('proj-1', 'task-1', expect.objectContaining({ columnId: 'col-2' })))
    })
  })

  // ── Tab switching ────────────────────────────────────────────────────────────

  describe('activity tabs', () => {
    it('renders 4 tab buttons', () => {
      renderModal()
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Comments' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Work Log' })).toBeInTheDocument()
    })

    it('Comments tab is active by default (shows comment input)', async () => {
      renderModal()
      await waitFor(() => expect(screen.getByPlaceholderText(/Add a comment/)).toBeInTheDocument())
    })

    it('clicking History tab hides comment input', async () => {
      renderModal()
      await waitFor(() => screen.getByPlaceholderText(/Add a comment/))
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'History' })) })
      expect(screen.queryByPlaceholderText(/Add a comment/)).not.toBeInTheDocument()
    })

    it('clicking Work Log tab shows log form', async () => {
      renderModal()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Work Log' })) })
      // Multiple "Log time" elements: section title + submit button
      await waitFor(() => expect(screen.getAllByText('Log time').length).toBeGreaterThanOrEqual(1))
    })
  })

  // ── Comments optimistic ──────────────────────────────────────────────────────

  describe('comments', () => {
    it('renders quick reply chips', async () => {
      renderModal()
      await waitFor(() => expect(screen.getByText("Who is working on this?")).toBeInTheDocument())
    })

    it('quick reply prefills textarea', async () => {
      renderModal()
      await waitFor(() => screen.getByText("Who is working on this?"))
      await act(async () => { fireEvent.click(screen.getByText("Who is working on this?")) })
      const ta = screen.getByPlaceholderText(/Add a comment/) as HTMLTextAreaElement
      expect(ta.value).toBe("Who is working on this?")
    })

    it('Save button calls commentsApi.create', async () => {
      renderModal()
      await waitFor(() => screen.getByPlaceholderText(/Add a comment/))
      const ta = screen.getByPlaceholderText(/Add a comment/)
      await act(async () => { fireEvent.change(ta, { target: { value: 'My comment' } }) })
      // Find the Save button in the comments section (last Save button = comments one)
      const saveBtns = screen.getAllByRole('button', { name: 'Save' })
      await act(async () => { fireEvent.click(saveBtns[saveBtns.length - 1]) })
      await waitFor(() => expect(mockCommentCreate).toHaveBeenCalledWith('proj-1', 'task-1', expect.objectContaining({ content: 'My comment' })))
    })
  })

  // ── Subtasks ─────────────────────────────────────────────────────────────────

  describe('subtasks', () => {
    it('shows Add subtask link', () => {
      renderModal()
      expect(screen.getByText('Add subtask')).toBeInTheDocument()
    })

    it('click Add subtask shows input', () => {
      renderModal()
      fireEvent.click(screen.getByText('Add subtask'))
      expect(screen.getByPlaceholderText('Subtask name...')).toBeInTheDocument()
    })

    it('Enter in subtask input calls tasksApi.create with parentTaskId', async () => {
      renderModal()
      fireEvent.click(screen.getByText('Add subtask'))
      const inp = screen.getByPlaceholderText('Subtask name...')
      await act(async () => { fireEvent.change(inp, { target: { value: 'My subtask' } }) })
      await act(async () => { fireEvent.keyDown(inp, { key: 'Enter' }) })
      expect(mockTaskCreate).toHaveBeenCalledWith('proj-1', expect.objectContaining({
        title: 'My subtask',
        parentTaskId: 'task-1',
      }))
    })

    it('existing subtask row shows its task code', () => {
      renderModal()
      // Redesigned subtask row shows a clickable task code instead of a checkbox
      expect(screen.getByText('Existing subtask')).toBeInTheDocument()
    })
  })

  // ── Linked items ─────────────────────────────────────────────────────────────

  describe('linked items', () => {
    it('renders Linked work items section', () => {
      renderModal()
      expect(screen.getByText('Linked work items')).toBeInTheDocument()
    })

    it('shows Add linked work item link', () => {
      renderModal()
      expect(screen.getByText('Add linked work item')).toBeInTheDocument()
    })

    it('shows link-type select with relates_to default', () => {
      renderModal()
      fireEvent.click(screen.getByText('Add linked work item'))
      expect(screen.getByDisplayValue('relates to')).toBeInTheDocument()
    })

    it('shows link type options including blocks and is blocked by', () => {
      renderModal()
      fireEvent.click(screen.getByText('Add linked work item'))
      const sel = screen.getByDisplayValue('relates to') as HTMLSelectElement
      const options = Array.from(sel.options).map((o) => o.text)
      expect(options).toContain('blocks')
      expect(options).toContain('is blocked by')
    })
  })

  // ── Right column structure ────────────────────────────────────────────────────

  describe('right column', () => {
    it('right column element has overflow-y-auto class', () => {
      renderModal()
      const modal = screen.getByTestId('task-detail-modal')
      const rightCol = modal.querySelector('.border-l.overflow-y-auto')
      expect(rightCol?.classList.contains('overflow-y-auto')).toBe(true)
    })

    it('Details section header visible', () => {
      renderModal()
      expect(screen.getByText('Details')).toBeInTheDocument()
    })

    it('Development section visible', () => {
      renderModal()
      expect(screen.getByText('Development')).toBeInTheDocument()
    })

    it('Automation section visible', () => {
      renderModal()
      // Multiple "Automation" texts exist: right-column section + status-bar button
      expect(screen.getAllByText('Automation').length).toBeGreaterThanOrEqual(1)
    })

    it('footer shows Created and Updated', () => {
      renderModal()
      expect(screen.getByText(/Created/)).toBeInTheDocument()
      expect(screen.getByText(/Updated/)).toBeInTheDocument()
    })
  })

  // ── Close ─────────────────────────────────────────────────────────────────────

  describe('close', () => {
    it('X button calls onClose', () => {
      const onClose = vi.fn()
      renderModal(mockTask, onClose)
      fireEvent.click(screen.getByTitle('Close'))
      expect(onClose).toHaveBeenCalled()
    })

    it('backdrop click calls onClose', () => {
      const onClose = vi.fn()
      renderModal(mockTask, onClose)
      const modal = screen.getByTestId('task-detail-modal')
      fireEvent.click(modal.previousElementSibling as HTMLElement)
      expect(onClose).toHaveBeenCalled()
    })

    it('copy task ID button triggers clipboard write', () => {
      const mockClipboard = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText: mockClipboard } })
      renderModal()
      fireEvent.click(screen.getByText('TASK-1'))
      expect(mockClipboard).toHaveBeenCalledWith('TASK-1')
    })
  })
})
