import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { Activity, Download } from 'lucide-react'
import { activityApi } from '@/api/activity'
import { membersApi } from '@/api/members'
import { useFilterStore } from '@/stores/useFilterStore'
import { Button, EmptyState, Skeleton } from '@/components/ui'
import { formatRelative } from '@/lib/utils'

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-success',
  updated: 'bg-info',
  deleted: 'bg-danger',
  moved: 'bg-warning',
  commented: 'bg-accent',
  assigned: 'bg-violet-500',
  status_changed: 'bg-cyan-500',
}

const ACTIONS = ['created', 'updated', 'deleted', 'moved', 'commented', 'assigned', 'status_changed']
const ENTITY_TYPES = ['task', 'comment', 'column', 'member', 'sprint', 'project']

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'
const PERIOD_DAYS: Record<Exclude<Period, 'custom'>, number> = { week: 7, month: 30, quarter: 90, year: 365 }

export function ActivityPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { activity, setActivityFilter, clearActivityFilters } = useFilterStore()
  const [page, setPage] = useState(1)

  // Draft filter state — committed to the store (which drives the query) on Apply
  const [period, setPeriod] = useState<Period>('custom')
  const [from, setFrom] = useState(activity.from ?? '')
  const [to, setTo] = useState(activity.to ?? '')
  const [userId, setUserId] = useState(activity.userId ?? '')
  const [action, setAction] = useState(activity.action?.[0] ?? '')
  const [entityType, setEntityType] = useState(activity.entityType?.[0] ?? '')

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['activity', projectId, activity, page],
    queryFn: () => activityApi.list(projectId, { ...activity, page, limit: 30 }),
    enabled: !!projectId,
  })

  const logs = data?.data ?? []

  const applyPeriod = (p: Exclude<Period, 'custom'>) => {
    setPeriod(p)
    setFrom(format(subDays(new Date(), PERIOD_DAYS[p]), 'yyyy-MM-dd'))
    setTo(format(new Date(), 'yyyy-MM-dd'))
  }

  const applyFilters = () => {
    setActivityFilter({
      from: from || undefined,
      to: to || undefined,
      userId: userId || undefined,
      action: action ? [action] : undefined,
      entityType: entityType ? [entityType] : undefined,
    })
    setPage(1)
  }

  const resetFilters = () => {
    setPeriod('custom'); setFrom(''); setTo(''); setUserId(''); setAction(''); setEntityType('')
    clearActivityFilters()
    setPage(1)
  }

  const handleExport = async () => {
    const res = await activityApi.export(projectId)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url; a.download = `activity-${projectId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg">Activity Log</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-b border-border shrink-0">
        {/* Period presets */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => applyPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${period === p ? 'bg-accent text-white' : 'text-fg-muted hover:bg-bg-subtle'}`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPeriod('custom') }}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-fg-subtle text-xs">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPeriod('custom') }}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All users</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.fullName}</option>)}
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg capitalize focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg capitalize focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <Button variant="primary" size="sm" onClick={applyFilters}>Apply</Button>
        <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={<Activity className="w-12 h-12" />} title="Không có hoạt động nào" />
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {logs.map((log) => {
                const member = members.find((m) => m.userId === log.userId)
                return (
                  <div key={log.id} className="relative">
                    <span className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-bg ${ACTION_COLORS[log.action] ?? 'bg-fg-subtle'}`} />
                    <div className="bg-bg-elevated border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-fg truncate">
                            {member?.user.fullName ?? log.userId.slice(0, 8)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] ? `bg-${ACTION_COLORS[log.action]}/10` : ''} text-fg-muted`}>
                            {log.action}
                          </span>
                          <span className="text-xs text-fg-subtle capitalize">{log.entityType}</span>
                        </div>
                        <span className="text-xs text-fg-subtle shrink-0">{formatRelative(log.createdAt)}</span>
                      </div>
                      {log.newValues && Object.keys(log.newValues).length > 0 && (
                        <div className="mt-1.5 text-xs text-fg-muted font-mono bg-bg rounded px-2 py-1 truncate">
                          {JSON.stringify(log.newValues).slice(0, 120)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {data && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</Button>
            <span className="flex items-center text-xs text-fg-muted px-3">
              Trang {page}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>Tiếp →</Button>
          </div>
        )}
      </div>
    </div>
  )
}
