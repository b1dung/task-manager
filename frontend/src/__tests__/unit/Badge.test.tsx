import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, PriorityBadge, TypeBadge, StatusBadge } from '@/components/ui'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Hello</Badge>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders dot when dot prop is set', () => {
    const { container } = render(<Badge dot>Dot</Badge>)
    expect(container.querySelector('.rounded-full')).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  it.each([
    ['urgent', 'Urgent'],
    ['high', 'High'],
    ['medium', 'Medium'],
    ['low', 'Low'],
  ])('renders %s priority', (priority, label) => {
    render(<PriorityBadge priority={priority} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('TypeBadge', () => {
  it.each([
    ['bug', 'Bug'],
    ['feature', 'Feature'],
    ['task', 'Task'],
    ['story', 'Story'],
    ['epic', 'Epic'],
  ])('renders %s type', (type, label) => {
    render(<TypeBadge type={type} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it.each([
    ['todo', 'Todo'],
    ['in_progress', 'In Progress'],
    ['in_review', 'In Review'],
    ['done', 'Done'],
  ])('renders %s status', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
