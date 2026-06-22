import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Sidebar } from '@/layout/Sidebar'

const PROJECTS = [
  { id: 'proj-1', name: 'ProjectA', slug: 'projecta', description: null, ownerId: 'u1', createdAt: '' },
  { id: 'proj-2', name: 'ProjectB', slug: 'projectb', description: null, ownerId: 'u1', createdAt: '' },
]

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/projects') {
        return Promise.resolve({ data: { data: PROJECTS } })
      }
      if (url.includes('/unread-count')) {
        return Promise.resolve({ data: { data: { count: 3 } } })
      }
      if (url.includes('/me/permissions')) {
        return Promise.resolve({ data: { data: { permissions: ['create_project'] } } })
      }
      return Promise.resolve({ data: { data: [] } })
    }),
    post: vi.fn().mockResolvedValue({
      data: { data: { id: 'new-proj', name: 'New', slug: 'new', description: null, ownerId: 'u1', createdAt: '' } },
    }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'u1', fullName: 'Dũng Bùi', email: 'test@test.com', avatarUrl: null, role: 'admin' },
      logout: vi.fn(),
      isAuthenticated: true,
      getState: () => ({ refreshToken: 'tok' }),
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/stores/useUIStore', () => {
  const setActiveProject = vi.fn()
  return {
    useUIStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        sidebarCollapsed: false,
        toggleSidebar: vi.fn(),
        setActiveProject,
      }
      return selector ? selector(state) : state
    },
    __setActiveProject: setActiveProject,
  }
})

vi.mock('@/api/auth', () => ({
  authApi: { logout: vi.fn().mockResolvedValue({}) },
}))

vi.mock('@/hooks/useSocket', () => ({ useSocket: () => null }))

function renderSidebar(path = '/projects/proj-1/tasks') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId/*" element={<Sidebar />} />
          <Route path="/projects" element={<Sidebar />} />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/projects/:projectId/tasks" element={<Sidebar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  it('shows current project name in dropdown trigger', async () => {
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByText('ProjectA')).toBeInTheDocument()
    })
  })

  it('nav items are rendered as links (full-width anchor elements)', async () => {
    renderSidebar()
    await waitFor(() => {
      const board = screen.getByText('Board')
      const link = board.closest('a')
      expect(link).toBeInTheDocument()
      expect(link?.className).toMatch(/w-full/)
    })
  })

  it('active nav item has accent text style', async () => {
    renderSidebar('/projects/proj-1/tasks')
    await waitFor(() => {
      expect(screen.getByText('Board')).toBeInTheDocument()
    })
    const boardLink = screen.getByText('Board').closest('a')
    expect(boardLink?.className).toMatch(/text-accent/)
  })

  it('opens dropdown when project trigger is clicked', async () => {
    renderSidebar()
    await waitFor(() => expect(screen.getByText('ProjectA')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('project-trigger'))

    await waitFor(() => {
      expect(screen.getByText('ProjectB')).toBeInTheDocument()
    })
  })

  it('closes dropdown when clicking outside', async () => {
    renderSidebar()
    await waitFor(() => expect(screen.getByText('ProjectA')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('project-trigger'))
    await waitFor(() => expect(screen.getByText('ProjectB')).toBeInTheDocument())

    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      // After close, dropdown items no longer visible
      expect(screen.queryByText('ProjectB')).not.toBeInTheDocument()
    })
  })

  it('shows notification badge with correct count', async () => {
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('opens create project modal when + button is clicked', async () => {
    renderSidebar()
    await waitFor(() => expect(screen.getByTitle('Create project')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Create project'))

    await waitFor(() => {
      expect(screen.getByText('Create project')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g. Website Redesign')).toBeInTheDocument()
    })
  })
})
