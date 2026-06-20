import { apiClient } from './client'
import type { ReportFilters } from '@/stores/useFilterStore'

export interface DailyPoint { date: string; completed: number }
export interface MonthlyKpi { from: string; to: string; target: number; actual: number; completionRate: number }
export interface CompletionSlice { status: string; count: number }
export interface HoursPoint { userId: string; estimatedHours: number; loggedHours: number }

export interface SummaryKpis {
  completed: number
  updated: number
  created: number
  dueSoon: number
  overdue: number
  blocked: number
}
export interface StatusSlice { status: string; count: number }
export interface PrioritySlice { priority: string; count: number }
export interface TypeSlice { type: string; count: number }
export interface WorkloadEntry {
  userId: string
  fullName: string
  avatarUrl: string | null
  assigned: number
  completed: number
}
export interface RecentActivityEntry {
  id: string
  action: string
  entityType: string
  userId: string
  userName: string | null
  userAvatar: string | null
  taskTitle: string | null
  taskNumber: number | null
  createdAt: string
}
export interface ProjectSummary {
  kpis: SummaryKpis
  total: number
  statusOverview: StatusSlice[]
  priorityDistribution: PrioritySlice[]
  taskTypes: TypeSlice[]
  teamWorkload: WorkloadEntry[]
  recentActivities: RecentActivityEntry[]
}

export type DeveloperGrade = 'excellent' | 'good' | 'average' | 'poor'
export interface DeveloperRow {
  userId: string
  fullName: string
  avatarUrl: string | null
  assigned: number
  completed: number
  completionRate: number
  loggedHours: number
  avgDuration: number
  overdue: number
  productivityScore: number
  grade: DeveloperGrade
}
export interface DevReportKpis {
  totalTasks: number
  completedTasks: number
  completionRate: number
  loggedHours: number
  overdueTasks: number
  avgCompletionTime: number
  productivityScore: number
}
export interface NamePoint { name: string; value: number }
export interface TaskDetailRow {
  id: string
  taskNumber: number | null
  title: string
  priority: string
  status: string
  estimatedHours: number | null
  loggedHours: number | null
  dueDate: string | null
  completedDate: string | null
  overdue: boolean
  lateDays: number
}
export interface DeveloperReport {
  kpis: DevReportKpis
  developers: DeveloperRow[]
  taskDistribution: NamePoint[]
  loggedHoursTrend: { week: string; hours: number }[]
  completionTrend: DailyPoint[]
  overdueAnalysis: NamePoint[]
  taskDetails: TaskDetailRow[]
}

export interface DevReportParams {
  from?: string
  to?: string
  userId?: string
  priority?: string
  type?: string
}

export const reportsApi = {
  summary: (projectId: string) =>
    apiClient.get<{ success: true; data: ProjectSummary }>(`/projects/${projectId}/reports/summary`).then((r) => r.data.data),
  developerReport: (projectId: string, params?: DevReportParams) =>
    apiClient.get<{ success: true; data: DeveloperReport }>(`/projects/${projectId}/reports/developer-report`, { params }).then((r) => r.data.data),
  weekly: (projectId: string, filters?: ReportFilters) =>
    apiClient.get<{ success: true; data: DailyPoint[] }>(`/projects/${projectId}/reports/weekly`, { params: filters }).then((r) => r.data.data),
  monthly: (projectId: string, filters?: ReportFilters) =>
    apiClient.get<{ success: true; data: MonthlyKpi }>(`/projects/${projectId}/reports/monthly-kpi`, { params: filters }).then((r) => r.data.data),
  productivity: (projectId: string, filters?: ReportFilters) =>
    apiClient.get<{ success: true; data: DailyPoint[] }>(`/projects/${projectId}/reports/productivity`, { params: filters }).then((r) => r.data.data),
  completionRate: (projectId: string, filters?: ReportFilters) =>
    apiClient.get<{ success: true; data: CompletionSlice[] }>(`/projects/${projectId}/reports/completion-rate`, { params: filters }).then((r) => r.data.data),
  workingHours: (projectId: string, filters?: ReportFilters) =>
    apiClient.get<{ success: true; data: HoursPoint[] }>(`/projects/${projectId}/reports/working-hours`, { params: filters }).then((r) => r.data.data),
}
