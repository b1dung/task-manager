import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { CheckCircle2, ListTodo, Percent, Clock, AlertTriangle, Timer, Gauge, Download, Printer } from 'lucide-react'
import { reportsApi, type DeveloperGrade, type DevReportParams } from '@/api/reports'
import { membersApi } from '@/api/members'
import { Avatar, Button, Skeleton, EmptyState, PriorityBadge, StatusBadge } from '@/components/ui'

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom'
const PERIOD_DAYS: Record<Exclude<Period, 'custom'>, number> = { week: 7, month: 30, quarter: 90, year: 365 }

const PRIORITY_OPTS = [
  { value: 'urgent', label: 'Highest' }, { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'lowest', label: 'Lowest' },
]

const GRADE_STYLE: Record<DeveloperGrade, { label: string; cls: string }> = {
  excellent: { label: 'Excellent', cls: 'bg-success/15 text-success' },
  good: { label: 'Good', cls: 'bg-info/15 text-info' },
  average: { label: 'Average', cls: 'bg-warning/15 text-warning' },
  poor: { label: 'Poor', cls: 'bg-danger/15 text-danger' },
}

const PIE_COLORS = ['#10b981', '#eab308', '#f97316', '#ef4444']
const CHART_TOOLTIP = { backgroundColor: '#1b1b23', border: '1px solid #2d2d38', borderRadius: 8, fontSize: 12 }

export function DeveloperReportPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()

  const [period, setPeriod] = useState<Period>('month')
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [userId, setUserId] = useState('')
  const [priority, setPriority] = useState('')
  // applied params drive the query
  const [params, setParams] = useState<DevReportParams>({ from, to })

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['developer-report', projectId, params],
    queryFn: () => reportsApi.developerReport(projectId, params),
    enabled: !!projectId,
  })

  const applyPeriod = (p: Exclude<Period, 'custom'>) => {
    const newTo = format(new Date(), 'yyyy-MM-dd')
    const newFrom = format(subDays(new Date(), PERIOD_DAYS[p]), 'yyyy-MM-dd')
    setPeriod(p); setFrom(newFrom); setTo(newTo)
  }

  const apply = () => setParams({ from, to, userId: userId || undefined, priority: priority || undefined })
  const reset = () => {
    const newTo = format(new Date(), 'yyyy-MM-dd')
    const newFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    setPeriod('month'); setFrom(newFrom); setTo(newTo); setUserId(''); setPriority('')
    setParams({ from: newFrom, to: newTo })
  }

  const exportCsv = () => {
    if (!data) return
    const header = ['Developer', 'Assigned', 'Completed', 'Completion Rate', 'Logged Hours', 'Avg Duration', 'Overdue', 'Productivity Score', 'Grade']
    const rows = data.developers.map((d) => [
      d.fullName, d.assigned, d.completed, `${d.completionRate}%`, d.loggedHours, `${d.avgDuration}d`, d.overdue, d.productivityScore, d.grade,
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `developer-report-${from}_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">Developer Performance Report</h1>
          <p className="text-xs text-fg-muted mt-0.5">Evaluate productivity, workload, overdue issues and logged hours.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> Export PDF</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
            <button key={p} onClick={() => applyPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${period === p ? 'bg-accent text-white' : 'text-fg-muted hover:bg-bg-subtle'}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPeriod('custom') }}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent" />
          <span className="text-fg-subtle text-xs">→</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPeriod('custom') }}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}
          className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">All developers</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.fullName}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}
          className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="">All priorities</option>
          {PRIORITY_OPTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <Button variant="primary" size="sm" onClick={apply}>Apply</Button>
        <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {isLoading ? (
            [...Array(7)].map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
          ) : (
            <>
              <Kpi icon={<ListTodo />} color="text-fg" value={data?.kpis.totalTasks ?? 0} label="Total Tasks" />
              <Kpi icon={<CheckCircle2 />} color="text-success" value={data?.kpis.completedTasks ?? 0} label="Completed" />
              <Kpi icon={<Percent />} color="text-accent" value={`${data?.kpis.completionRate ?? 0}%`} label="Completion Rate" />
              <Kpi icon={<Clock />} color="text-info" value={`${data?.kpis.loggedHours ?? 0}h`} label="Logged Hours" />
              <Kpi icon={<AlertTriangle />} color="text-danger" value={data?.kpis.overdueTasks ?? 0} label="Overdue" />
              <Kpi icon={<Timer />} color="text-warning" value={`${data?.kpis.avgCompletionTime ?? 0}d`} label="Avg Completion" />
              <Kpi icon={<Gauge />} color="text-violet-400" value={`${data?.kpis.productivityScore ?? 0}%`} label="Productivity" />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Task Distribution" loading={isLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.taskDistribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8888a0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8888a0' }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={CHART_TOOLTIP} />
                <Bar dataKey="value" fill="#8166ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Logged Hours Trend" loading={isLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.loggedHoursTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#8888a0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8888a0' }} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Line type="monotone" dataKey="hours" stroke="#34c77b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Completion Trend" loading={isLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.completionTrend ?? []}>
                <defs>
                  <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8166ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8166ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8888a0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8888a0' }} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Area type="monotone" dataKey="completed" stroke="#8166ff" strokeWidth={2} fill="url(#compGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Overdue Analysis" loading={isLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.overdueAnalysis ?? []} dataKey="value" nameKey="name"
                  innerRadius={50} outerRadius={85} paddingAngle={2}
                  label={({ name, value }) => (value ? `${name}: ${value}` : '')}>
                  {(data?.overdueAnalysis ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Developer summary table */}
        <div className="rounded-card border border-border bg-bg-elevated overflow-hidden">
          <p className="text-sm font-semibold text-fg px-5 py-3 border-b border-border">Developer Summary</p>
          {isLoading ? (
            <div className="p-5 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (data?.developers.length ?? 0) === 0 ? (
            <div className="py-10"><EmptyState title="No developer data in this period" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bg-surface text-fg-subtle">
                  <tr className="text-left">
                    {['Developer', 'Assigned', 'Completed', 'Rate', 'Logged', 'Avg Dur.', 'Overdue', 'Score', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.developers.map((d) => (
                    <tr key={d.userId} className="border-t border-border hover:bg-bg-subtle/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={d.fullName} avatarUrl={d.avatarUrl} size="xs" />
                          <span className="text-fg font-medium whitespace-nowrap">{d.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-fg-muted">{d.assigned}</td>
                      <td className="px-4 py-2 text-fg-muted">{d.completed}</td>
                      <td className="px-4 py-2 text-fg-muted">{d.completionRate}%</td>
                      <td className="px-4 py-2 text-fg-muted">{d.loggedHours}h</td>
                      <td className="px-4 py-2 text-fg-muted">{d.avgDuration}d</td>
                      <td className="px-4 py-2">
                        <span className={d.overdue > 0 ? 'text-danger font-medium' : 'text-fg-muted'}>{d.overdue}</span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-fg">{d.productivityScore}%</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${GRADE_STYLE[d.grade].cls}`}>
                          {GRADE_STYLE[d.grade].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Task details table */}
        <div className="rounded-card border border-border bg-bg-elevated overflow-hidden">
          <p className="text-sm font-semibold text-fg px-5 py-3 border-b border-border">Task Details</p>
          {isLoading ? (
            <div className="p-5 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : (data?.taskDetails.length ?? 0) === 0 ? (
            <div className="py-10"><EmptyState title="No tasks in this period" /></div>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bg-surface text-fg-subtle z-10">
                  <tr className="text-left">
                    {['Summary', 'Priority', 'Status', 'Est.', 'Logged', 'Due', 'Completed', 'Overdue'].map((h) => (
                      <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.taskDetails.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-bg-subtle/50">
                      <td className="px-4 py-2 max-w-xs"><span className="text-fg truncate block">{t.title}</span></td>
                      <td className="px-4 py-2"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-2 text-fg-muted">{t.estimatedHours ?? '—'}</td>
                      <td className="px-4 py-2 text-fg-muted">{t.loggedHours ?? '—'}</td>
                      <td className="px-4 py-2 text-fg-muted whitespace-nowrap">{t.dueDate?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 text-fg-muted whitespace-nowrap">{t.completedDate ?? '—'}</td>
                      <td className="px-4 py-2">
                        {t.overdue || t.lateDays > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger/15 text-danger whitespace-nowrap">
                            Late by {t.lateDays}d
                          </span>
                        ) : (
                          <span className="text-success">On time</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon, color, value, label }: { icon: ReactNode; color: string; value: ReactNode; label: string }) {
  return (
    <div className="rounded-card border border-border bg-bg-elevated p-3">
      <span className={`[&>svg]:w-4 [&>svg]:h-4 ${color}`}>{icon}</span>
      <p className="text-xl font-bold text-fg mt-1.5">{value}</p>
      <p className="text-[11px] text-fg-muted mt-0.5">{label}</p>
    </div>
  )
}

function ChartCard({ title, children, loading }: { title: string; children: ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-bg-elevated p-5">
      <p className="text-sm font-semibold text-fg mb-4">{title}</p>
      {loading ? <Skeleton className="h-52" /> : children}
    </div>
  )
}
