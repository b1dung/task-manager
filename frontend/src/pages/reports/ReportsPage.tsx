import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { reportsApi } from '@/api/reports'
import { membersApi } from '@/api/members'
import { sprintsApi } from '@/api/sprints'
import { useFilterStore } from '@/stores/useFilterStore'
import { Button, Skeleton } from '@/components/ui'
import { format, subDays } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  in_review: '#f59e0b',
  done: '#10b981',
}

const SHORTCUTS = [
  { label: 'Tuần này', days: 7 },
  { label: 'Tháng này', days: 30 },
  { label: '3 tháng', days: 90 },
]

export function ReportsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { reports, setReportFilter } = useFilterStore()

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
    enabled: !!projectId,
  })
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
    enabled: !!projectId,
  })

  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ['reports', 'weekly', projectId, reports],
    queryFn: () => reportsApi.weekly(projectId, reports),
    enabled: !!projectId,
  })
  const { data: monthly } = useQuery({
    queryKey: ['reports', 'monthly', projectId, reports],
    queryFn: () => reportsApi.monthly(projectId, reports),
    enabled: !!projectId,
  })
  const { data: productivity } = useQuery({
    queryKey: ['reports', 'productivity', projectId, reports],
    queryFn: () => reportsApi.productivity(projectId, reports),
    enabled: !!projectId,
  })
  const { data: completion } = useQuery({
    queryKey: ['reports', 'completion', projectId, reports],
    queryFn: () => reportsApi.completionRate(projectId, reports),
    enabled: !!projectId,
  })
  const { data: hours } = useQuery({
    queryKey: ['reports', 'hours', projectId, reports],
    queryFn: () => reportsApi.workingHours(projectId, reports),
    enabled: !!projectId,
  })

  const applyShortcut = (days: number) => {
    const to = format(new Date(), 'yyyy-MM-dd')
    const from = format(subDays(new Date(), days), 'yyyy-MM-dd')
    setReportFilter({ from, to })
  }

  // A shortcut is "active" when the current range matches its [today-days, today] window.
  const today = format(new Date(), 'yyyy-MM-dd')
  const isShortcutActive = (days: number) =>
    reports.to === today && reports.from === format(subDays(new Date(), days), 'yyyy-MM-dd')

  // Default to "Tuần này" when no range has been picked yet.
  useEffect(() => {
    if (!reports.from && !reports.to) applyShortcut(7)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + filters */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-fg mb-3">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Shortcuts */}
          {SHORTCUTS.map((s) => (
            <Button
              key={s.label}
              variant={isShortcutActive(s.days) ? 'primary' : 'outline'}
              size="sm"
              onClick={() => applyShortcut(s.days)}
            >
              {s.label}
            </Button>
          ))}

          {/* Date range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={reports.from ?? ''}
              onChange={(e) => setReportFilter({ from: e.target.value || undefined })}
              className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <span className="text-fg-subtle text-xs">→</span>
            <input
              type="date"
              value={reports.to ?? ''}
              onChange={(e) => setReportFilter({ to: e.target.value || undefined })}
              className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {members.length > 0 && (
            <select
              value={reports.userId ?? ''}
              onChange={(e) => setReportFilter({ userId: e.target.value || undefined })}
              className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Tất cả thành viên</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.fullName}</option>)}
            </select>
          )}

          {sprints.length > 0 && (
            <select
              value={reports.sprintId ?? ''}
              onChange={(e) => setReportFilter({ sprintId: e.target.value || undefined })}
              className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Tất cả sprint</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Monthly KPI */}
        {monthly && (
          <div className="xl:col-span-2 grid grid-cols-3 gap-4">
            {[
              { label: 'Target Tasks', value: monthly.target, color: 'text-fg' },
              { label: 'Actual Done', value: monthly.actual, color: 'text-success' },
              { label: 'Completion Rate', value: `${monthly.completionRate}%`, color: 'text-accent' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-card border border-border bg-bg-elevated p-4">
                <p className="text-xs text-fg-muted">{kpi.label}</p>
                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Bar Chart */}
        <ChartCard title="Hoàn thành task (tuần này)" loading={weeklyLoading}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekly ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8888a0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8888a0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8 }} />
              <Bar dataKey="completed" fill="#8166ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Productivity Line Chart */}
        <ChartCard title="Năng suất (30 ngày)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={productivity ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8888a0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8888a0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8 }} />
              <Line type="monotone" dataKey="completed" stroke="#8166ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Completion Rate Donut */}
        <ChartCard title="Tỷ lệ hoàn thành theo status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={completion ?? []}
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {(completion ?? []).map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#8888a0'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Working Hours Stacked Bar */}
        <ChartCard title="Giờ làm việc (Estimated vs Logged)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hours ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="userId" tickFormatter={(id) => id.slice(0, 6)} tick={{ fontSize: 11, fill: '#8888a0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8888a0' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="estimatedHours" name="Estimated" fill="#8166ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="loggedHours" name="Logged" fill="#34c77b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children, loading }: { title: string; children: ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-bg-elevated p-4">
      <p className="text-sm font-medium text-fg mb-4">{title}</p>
      {loading ? <Skeleton className="h-48" /> : children}
    </div>
  )
}
