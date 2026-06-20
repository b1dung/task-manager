import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BoardPage } from '@/pages/board/BoardPage'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/columns')) {
        return Promise.resolve({
          data: {
            data: [
              { id: 'col-1', name: 'To Do', position: 0, wipLimit: null, projectId: 'proj-1', tasks: [] },
              { id: 'col-2', name: 'In Progress', position: 1, wipLimit: 3, projectId: 'proj-1', tasks: [] },
            ],
          },
        })
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 't1',
                columnId: 'col-1',
                title: 'Task Alpha',
                priority: 'high',
                type: 'bug',
                status: 'todo',
                position: 0,
                parentTaskId: null,   // parent task
                labels: [],
                assignee: null,
                dueDate: null,
                subtaskCount: 1,
                subtasksPreview: [
                  { id: 'sub-1', title: 'Sub of Alpha', status: 'todo', assigneeId: null, assignee: null, parentTaskId: 't1' },
                ],
              },
              {
                id: 'sub-1',
                columnId: 'col-1',
                title: 'Sub of Alpha (should be hidden)',
                priority: 'low',
                type: 'task',
                status: 'todo',
                position: 1,
                parentTaskId: 't1',  // subtask — should NOT appear as a card
                labels: [],
                assignee: null,
                dueDate: null,
                subtaskCount: 0,
              },
            ],
            meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
          },
        })
      }
      if (url.includes('/members')) {
        return Promise.resolve({ data: { data: [] } })
      }
      if (url.includes('/labels')) {
        return Promise.resolve({ data: { data: [] } })
      }
      if (url.includes('/sprints')) {
        return Promise.resolve({ data: { data: [] } })
      }
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', fullName: 'Alice', avatarUrl: null },
    accessToken: 'mock-token',
  }),
}))

vi.mock('@/stores/useUIStore', () => ({
  useUIStore: () => ({
    activeProjectId: 'proj-1',
    setActiveProjectId: vi.fn(),
    sidebarCollapsed: false,
  }),
}))

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/projects/proj-1/board']}>
        <Routes>
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BoardView', () => {
  it('renders column headers', async () => {
    renderBoard()
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })
  })

  it('renders tasks in correct columns', async () => {
    renderBoard()
    await waitFor(() => {
      expect(screen.getByText('Task Alpha')).toBeInTheDocument()
    })
  })

  it('shows add column button', async () => {
    renderBoard()
    await waitFor(() => {
      // AddColumnCard renders "Thêm column" button
      expect(screen.getByText(/thêm column/i)).toBeInTheDocument()
    })
  })

  it('shows task count badge on column header', async () => {
    renderBoard()
    await waitFor(() => {
      // col-1 has 1 parent task (col-2 has 0)
      expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })
  })

  it('renders filter bar', async () => {
    renderBoard()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/tìm task/i)).toBeInTheDocument()
    })
  })

  it('does NOT render subtask as standalone card on board', async () => {
    renderBoard()
    await waitFor(() => {
      expect(screen.getByText('Task Alpha')).toBeInTheDocument()
    })
    // The subtask with parentTaskId should NOT appear as a separate card
    expect(screen.queryByText('Sub of Alpha (should be hidden)')).not.toBeInTheDocument()
  })

  it('only shows parent tasks (parentTaskId === null) in column', async () => {
    renderBoard()
    await waitFor(() => {
      expect(screen.getAllByText(/Task Alpha/).length).toBeGreaterThan(0)
    })
    // Column task count badge should show 1 (only parent), not 2
    // The WIP limit "3" is still there, count badge is "1"
    await waitFor(() => {
      const countBadge = screen.getAllByText('1')
      expect(countBadge.length).toBeGreaterThan(0)
    })
  })
})
