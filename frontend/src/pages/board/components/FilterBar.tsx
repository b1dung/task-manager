import React, {useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Search, X, SlidersHorizontal} from 'lucide-react'
import {useQuery} from '@tanstack/react-query'
import {membersApi} from '@/api/members'
import {labelsApi} from '@/api/labels'
import {sprintsApi} from '@/api/sprints'
import {useFilterStore} from '@/stores/useFilterStore'
import {useDebounce} from '@/hooks/useDebounce'
import {Avatar} from '@/components/ui'
import {cn} from '@/lib/utils'

const PRIORITY_OPTIONS = [
    {value: 'urgent', label: 'Urgent', svg: '/priority/highest_new.svg'},
    {value: 'high', label: 'High', svg: '/priority/high_new.svg'},
    {value: 'medium', label: 'Medium', svg: '/priority/medium_new.svg'},
    {value: 'low', label: 'Low', svg: '/priority/low_new.svg'},
    {value: 'lowest', label: 'Lowest', svg: '/priority/lowest_new.svg'},
]

const DUE_OPTIONS = [
    {value: 'overdue', label: 'Quá hạn'},
    {value: 'today', label: 'Hôm nay'},
    {value: 'this_week', label: 'Tuần này'},
    {value: 'no_due_date', label: 'Không có hạn'},
]

interface FilterBarProps {
    projectId: string
}

export function FilterBar({projectId}: FilterBarProps) {
    const {board, setBoardFilter, clearBoardFilters} = useFilterStore()
    const [q, setQ] = useState(board.q ?? '')
    const [open, setOpen] = useState(false)
    const debouncedQ = useDebounce(q, 300)

    const {data: members = []} = useQuery({
        queryKey: ['members', projectId],
        queryFn: () => membersApi.list(projectId),
    })
    const {data: labels = []} = useQuery({
        queryKey: ['labels', projectId],
        queryFn: () => labelsApi.list(projectId),
    })
    const {data: sprints = []} = useQuery({
        queryKey: ['sprints', projectId],
        queryFn: () => sprintsApi.list(projectId),
    })

    useEffect(() => {
        setBoardFilter({q: debouncedQ || undefined})
    }, [debouncedQ, setBoardFilter])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    const toggleMulti = (field: 'priority' | 'assigneeId' | 'labelId', val: string) => {
        const current = (board[field] ?? []) as string[]
        const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
        setBoardFilter({[field]: next.length ? next : undefined})
    }

    const activeCount = [
        board.priority?.length ?? 0,
        board.assigneeId?.length ?? 0,
        board.labelId?.length ?? 0,
        board.sprintId ? 1 : 0,
        board.due ? 1 : 0,
        (board.createdFrom || board.createdTo) ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    return (
        <>
            <div className="flex items-center gap-2 pb-2">
                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle"/>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Tìm task..."
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {q && (
                        <button onClick={() => setQ('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    )}
                </div>

                {/* Filter button */}
                <button
                    onClick={() => setOpen(true)}
                    className={cn(
                        'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-sm font-medium transition-colors',
                        activeCount > 0
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border text-fg-muted hover:border-border-bright hover:text-fg',
                    )}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5"/>
                    Filter
                    {activeCount > 0 && (
                        <span
                            className="flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold leading-none">
              {activeCount}
            </span>
                    )}
                </button>

                {/* Clear */}
                {activeCount > 0 && (
                    <button
                        onClick={clearBoardFilters}
                        className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-sm text-fg-muted hover:text-fg hover:border-border-bright transition-colors"
                    >
                        <X className="w-3.5 h-3.5"/>
                        Xóa
                    </button>
                )}
            </div>

            {/* Centered modal */}
            {open ? createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setOpen(false)
                    }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50"/>

                    {/* Panel */}
                    <div
                        className="relative w-full max-w-xl rounded-2xl border border-border bg-bg-surface shadow-app-lg flex flex-col max-h-[85vh] animate-modal-enter">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-fg-muted"/>
                                <span className="text-sm font-semibold text-fg">Bộ lọc</span>
                                {activeCount > 0 && (
                                    <span
                                        className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold">
                    {activeCount}
                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeCount > 0 && (
                                    <button
                                        onClick={clearBoardFilters}
                                        className="text-xs text-fg-muted hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-bg-subtle"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                                <button
                                    onClick={() => setOpen(false)}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto scrollbar-thin p-5 space-y-6">

                            {/* Assignees */}
                            {members.length > 0 && (
                                <FilterSection label="Assignee">
                                    <div className="flex flex-wrap gap-2">
                                        {members.map((m) => {
                                            const active = board.assigneeId?.includes(m.userId)
                                            return (
                                                <button
                                                    key={m.userId}
                                                    onClick={() => toggleMulti('assigneeId', m.userId)}
                                                    className={cn(
                                                        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
                                                        active
                                                            ? 'border-accent bg-accent/10 text-fg'
                                                            : 'border-border text-fg-muted hover:border-border-bright hover:text-fg',
                                                    )}
                                                >
                                                    <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl}
                                                            size="md"/>
                                                    <span className="max-w-[120px] truncate">{m.user.fullName}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </FilterSection>
                            )}

                            {/* Priority */}
                            <FilterSection label="Priority">
                                <div className="flex flex-wrap gap-2">
                                    {PRIORITY_OPTIONS.map((p) => {
                                        const active = board.priority?.includes(p.value)
                                        return (
                                            <button
                                                key={p.value}
                                                onClick={() => toggleMulti('priority', p.value)}
                                                className={cn(
                                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                                                    active
                                                        ? 'border-accent bg-accent/10 text-fg'
                                                        : 'border-border text-fg-muted hover:border-border-bright hover:text-fg',
                                                )}
                                            >
                                                <img src={p.svg} alt={p.label} width={13} height={13}/>
                                                {p.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </FilterSection>

                            {/* Labels */}
                            {labels.length > 0 && (
                                <FilterSection label="Labels">
                                    <div className="flex flex-wrap gap-2">
                                        {labels.map((l) => {
                                            const active = board.labelId?.includes(l.id)
                                            return (
                                                <button
                                                    key={l.id}
                                                    onClick={() => toggleMulti('labelId', l.id)}
                                                    className={cn(
                                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border text-xs transition-colors',
                                                        active
                                                            ? 'border-accent bg-accent/10 text-fg'
                                                            : 'border-border text-fg-muted hover:border-border-bright hover:text-fg',
                                                    )}
                                                >
                                                    <span className="w-2 h-2 rounded-full shrink-0"
                                                          style={{backgroundColor: l.color}}/>
                                                    {l.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </FilterSection>
                            )}

                            {/* Sprint + Due — 2 cột */}
                            <div className="grid grid-cols-2 gap-5">
                                {sprints.length > 0 && (
                                    <FilterSection label="Sprint">
                                        <select
                                            value={board.sprintId ?? ''}
                                            onChange={(e) => setBoardFilter({sprintId: e.target.value || undefined})}
                                            className="w-full h-8 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                                        >
                                            <option value="">Tất cả</option>
                                            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </FilterSection>
                                )}

                                <FilterSection label="Due date">
                                    <div className="flex flex-wrap gap-1.5">
                                        {DUE_OPTIONS.map((o) => {
                                            const active = board.due === o.value
                                            return (
                                                <button
                                                    key={o.value}
                                                    onClick={() => setBoardFilter({due: active ? undefined : o.value})}
                                                    className={cn(
                                                        'px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
                                                        active
                                                            ? 'border-accent bg-accent/10 text-fg'
                                                            : 'border-border text-fg-muted hover:border-border-bright hover:text-fg',
                                                    )}
                                                >
                                                    {o.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </FilterSection>
                            </div>

                            {/* Created date range */}
                            <FilterSection label="Created">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[11px] text-fg-subtle mb-1.5">Từ ngày</p>
                                        <input
                                            type="date"
                                            value={board.createdFrom ?? ''}
                                            onChange={(e) => setBoardFilter({createdFrom: e.target.value || undefined})}
                                            className="w-full h-8 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-fg-subtle mb-1.5">Đến ngày</p>
                                        <input
                                            type="date"
                                            value={board.createdTo ?? ''}
                                            onChange={(e) => setBoardFilter({createdTo: e.target.value || undefined})}
                                            className="w-full h-8 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                                        />
                                    </div>
                                </div>
                                {(board.createdFrom || board.createdTo) && (
                                    <button
                                        onClick={() => setBoardFilter({createdFrom: undefined, createdTo: undefined})}
                                        className="mt-1.5 text-xs text-fg-subtle hover:text-danger transition-colors flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3"/> Xóa ngày
                                    </button>
                                )}
                            </FilterSection>

                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
                            <button
                                onClick={() => setOpen(false)}
                                className="h-8 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                            >
                                Áp dụng
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            ) : null}
        </>
    )
}

function FilterSection({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2.5">
            <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">{label}</p>
            {children}
        </div>
    )
}
