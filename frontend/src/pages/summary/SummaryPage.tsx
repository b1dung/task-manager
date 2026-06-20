import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  RefreshCw, Download, CheckCircle2, RefreshCcw, PlusCircle,
  Clock, AlertTriangle, Ban,
} from 'lucide-react'
import { reportsApi, type ProjectSummary } from '@/api/reports'
import { projectsApi } from '@/api/projects'
import { Avatar, Button, EmptyState, Skeleton } from '@/components/ui'
import { formatRelative } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { DEFAULT_TIMEZONE, formatZonedDateTime } from '@/lib/timezones'

// ─── Config ─────────────────────────────────────────────────────────────────

function getProjectKey(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? words.map((w) => w[0]).join('').toUpperCase()
    : name.slice(0, 5).toUpperCase()
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#6b7280' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  in_review: { label: 'In Review', color: '#f59e0b' },
  done: { label: 'Done', color: '#10b981' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Highest', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: '#eab308' },
  low: { label: 'Low', color: '#3b82f6' },
  lowest: { label: 'Lowest', color: '#6b7280' },
}
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low', 'lowest']

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  epic: { label: 'Epic', color: '#8b5cf6' },
  story: { label: 'Story', color: '#10b981' },
  task: { label: 'Task', color: '#3b82f6' },
  bug: { label: 'Bug', color: '#ef4444' },
  feature: { label: 'Feature', color: '#06b6d4' },
}
const TYPE_ORDER = ['task', 'story', 'epic', 'bug', 'feature']

const ACTION_LABEL: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  moved: 'moved',
  commented: 'commented on',
  assigned: 'assigned',
  status_changed: 'changed status of',
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function SummaryPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
    staleTime: 10 * 60_000,
  })
  const projectKey = project ? getProjectKey(project.name) : 'TASK'

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['summary', projectId],
    queryFn: () => reportsApi.summary(projectId),
    enabled: !!projectId,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">Summary</h1>
          <p className="text-xs text-fg-muted mt-0.5">
            Get a snapshot of your project activities and team performance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="w-4 h-4" /> Export Report
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)
          ) : (
            <>
              <KpiCard icon={<CheckCircle2 />} color="text-success" value={data?.kpis.completed ?? 0}
                label="Completed" hint="Completed within last 7 days." />
              <KpiCard icon={<RefreshCcw />} color="text-info" value={data?.kpis.updated ?? 0}
                label="Updated" hint="Updated within last 7 days." />
              <KpiCard icon={<PlusCircle />} color="text-accent" value={data?.kpis.created ?? 0}
                label="Created" hint="Created within last 7 days." />
              <KpiCard icon={<Clock />} color="text-warning" value={data?.kpis.dueSoon ?? 0}
                label="Due Soon" hint="Tasks due within 7 days." />
              <KpiCard icon={<AlertTriangle />} color="text-danger" value={data?.kpis.overdue ?? 0}
                label="Overdue" hint="Tasks overdue." />
              <KpiCard icon={<Ban />} color="text-fg-muted" value={data?.kpis.blocked ?? 0}
                label="Blocked" hint="Tasks blocked." />
            </>
          )}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <StatusOverview data={data} loading={isLoading} />
          <RecentActivities data={data} loading={isLoading} projectKey={projectKey} />
          <PriorityDistribution data={data} loading={isLoading} />
          <TaskTypes data={data} loading={isLoading} />
        </div>

        {/* Team workload — full width */}
        <TeamWorkload data={data} loading={isLoading} />
      </div>
    </div>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, color, value, label, hint }: {
  icon: ReactNode; color: string; value: number; label: string; hint: string
}) {
  return (
    <div className="rounded-card border border-border bg-bg-elevated p-4 transition-colors hover:border-accent/50">
      <div className={`mb-2 ${color}`}>
        <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-fg">{value}</p>
      <p className="text-xs font-medium text-fg mt-0.5">{label}</p>
      <p className="text-[11px] text-fg-subtle mt-1 leading-tight">{hint}</p>
    </div>
  )
}

// ─── Card shell ─────────────────────────────────────────────────────────────

function Card({ title, description, children, className }: {
  title: string; description?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={`rounded-card border border-border bg-bg-elevated p-5 ${className ?? ''}`}>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="text-xs text-fg-muted mt-0.5 mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  )
}

// ─── Status Overview (donut) ────────────────────────────────────────────────

function StatusOverview({ data, loading }: { data?: ProjectSummary; loading: boolean }) {
  const slices = (data?.statusOverview ?? []).map((s) => ({
    name: STATUS_CONFIG[s.status]?.label ?? s.status,
    value: s.count,
    color: STATUS_CONFIG[s.status]?.color ?? '#6b7280',
  }))
  const total = data?.total ?? 0

  return (
    <Card title="Status Overview" description="Get a snapshot of current task statuses.">
      {loading ? (
        <Skeleton className="h-64" />
      ) : slices.length === 0 ? (
        <EmptyState title="No tasks yet" />
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="name"
                  innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                  {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-fg">{total}</span>
              <span className="text-[11px] text-fg-subtle">Total Work Items</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 max-h-52 overflow-y-auto scrollbar-thin space-y-1.5 pr-1">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate text-fg-muted">{s.name}</span>
                <span className="font-medium text-fg">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Recent Activities ──────────────────────────────────────────────────────

function RecentActivities({ data, loading, projectKey }: {
  data?: ProjectSummary; loading: boolean; projectKey: string
}) {
  const timezone = useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIMEZONE)
  const items = data?.recentActivities ?? []
  return (
    <Card title="Recent Activities" description="Latest changes across the project.">
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No recent activity" />
      ) : (
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin space-y-3 pr-1">
          {items.map((a) => {
            const taskRef = a.taskNumber != null ? `${projectKey}-${a.taskNumber}` : null
            return (
              <div key={a.id} className="flex items-start gap-3">
                <Avatar name={a.userName ?? '?'} avatarUrl={a.userAvatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg leading-snug">
                    <span className="font-medium">{a.userName ?? 'Someone'}</span>{' '}
                    <span className="text-fg-muted">{ACTION_LABEL[a.action] ?? a.action}</span>{' '}
                    {taskRef && <span className="font-medium text-accent">{taskRef}</span>}
                    {a.taskTitle && <span className="text-fg-muted"> · {a.taskTitle}</span>}
                  </p>
                  <p className="text-[11px] text-fg-subtle mt-0.5" title={formatRelative(a.createdAt, timezone)}>
                    {formatZonedDateTime(a.createdAt, timezone)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Priority Distribution ──────────────────────────────────────────────────

function PriorityDistribution({ data, loading }: { data?: ProjectSummary; loading: boolean }) {
  const map = new Map((data?.priorityDistribution ?? []).map((p) => [p.priority, p.count]))
  const bars = PRIORITY_ORDER.map((key) => ({
    name: PRIORITY_CONFIG[key].label,
    count: map.get(key) ?? 0,
    color: PRIORITY_CONFIG[key].color,
  }))

  return (
    <Card title="Priority Distribution" description="Tasks grouped by priority.">
      {loading ? (
        <Skeleton className="h-56" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bars}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8888a0' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8888a0' }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {bars.map((b) => <Cell key={b.name} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ─── Task Types ─────────────────────────────────────────────────────────────

function TaskTypes({ data, loading }: { data?: ProjectSummary; loading: boolean }) {
  const map = new Map((data?.taskTypes ?? []).map((t) => [t.type, t.count]))
  const total = data?.total ?? 0
  const rows = TYPE_ORDER
    .map((key) => ({ key, label: TYPE_CONFIG[key].label, color: TYPE_CONFIG[key].color, count: map.get(key) ?? 0 }))
    .filter((r) => r.count > 0 || ['task', 'story', 'bug'].includes(r.key))

  return (
    <Card title="Task Types" description="Distribution by issue type.">
      {loading ? (
        <Skeleton className="h-56" />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
            return (
              <div key={r.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-fg">{r.label}</span>
                  <span className="text-fg-muted">{r.count} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: r.color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Team Workload ──────────────────────────────────────────────────────────

function TeamWorkload({ data, loading }: { data?: ProjectSummary; loading: boolean }) {
  const members = data?.teamWorkload ?? []
  return (
    <Card title="Team Workload" description="Assigned vs completed per developer.">
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : members.length === 0 ? (
        <EmptyState title="No assigned tasks" />
      ) : (
        <div className="max-h-96 overflow-y-auto scrollbar-thin grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-1">
          {members.map((m) => {
            const pct = m.assigned > 0 ? Math.round((m.completed / m.assigned) * 100) : 0
            return (
              <div key={m.userId} className="rounded-lg border border-border bg-bg p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.fullName} avatarUrl={m.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{m.fullName}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {m.completed}/{m.assigned} completed
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{pct}%</span>
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-bg-subtle overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
