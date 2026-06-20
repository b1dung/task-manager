import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommentThread } from '@/pages/board/components/CommentThread'

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', fullName: 'Alice', avatarUrl: null },
  }),
}))

const comments = [
  {
    id: 'c1',
    taskId: 'task-1',
    parentId: null,
    content: 'First comment',
    authorId: 'user-1',
    author: { id: 'user-1', fullName: 'Alice', avatarUrl: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    replies: [],
  },
  {
    id: 'c2',
    taskId: 'task-1',
    parentId: null,
    content: 'Second comment',
    authorId: 'user-2',
    author: { id: 'user-2', fullName: 'Bob', avatarUrl: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    replies: [],
  },
]

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderThread(taskId = 'task-1', initialComments = comments) {
  const qc = makeQc()
  qc.setQueryData(['comments', 'proj-1', taskId], initialComments)
  return render(
    <QueryClientProvider client={qc}>
      <CommentThread projectId="proj-1" taskId={taskId} />
    </QueryClientProvider>,
  )
}

describe('CommentThread', () => {
  it('renders all top-level comments', async () => {
    renderThread()
    await waitFor(() => {
      expect(screen.getByText('First comment')).toBeInTheDocument()
      expect(screen.getByText('Second comment')).toBeInTheDocument()
    })
  })

  it('shows comment authors', async () => {
    renderThread()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('shows textarea for new comment', () => {
    renderThread()
    expect(screen.getByPlaceholderText(/viết comment/i)).toBeInTheDocument()
  })

  it('reply button is visible for each comment', async () => {
    renderThread()
    await waitFor(() => {
      const replyButtons = screen.getAllByText(/trả lời/i)
      expect(replyButtons.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows edit/delete for own comments', async () => {
    renderThread()
    await waitFor(() => {
      const editButtons = screen.getAllByTitle(/chỉnh sửa/i)
      expect(editButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not show edit for other users comments', async () => {
    renderThread()
    await waitFor(() => {
      expect(screen.queryAllByTitle(/chỉnh sửa/i).length).toBeLessThan(2)
    })
  })
})
