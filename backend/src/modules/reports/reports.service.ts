import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TaskPriority, TaskStatus, TaskType } from '@shared/enums';
import { QueryReportsDto } from '@/modules/reports/dto/query-reports.dto';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';
import { WorkingHour } from '@/modules/reports/entities/working-hour.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

export interface DailyCompletionPoint {
  date: string;
  completed: number;
}

export interface MonthlyKpi {
  from: string;
  to: string;
  target: number;
  actual: number;
  completionRate: number;
}

export interface CompletionRateSlice {
  status: TaskStatus;
  count: number;
}

export interface WorkingHoursPoint {
  userId: string;
  estimatedHours: number;
  loggedHours: number;
}

export interface SummaryKpis {
  completed: number;
  updated: number;
  created: number;
  dueSoon: number;
  overdue: number;
  blocked: number;
}

export interface StatusSlice {
  status: TaskStatus;
  count: number;
}

export interface PrioritySlice {
  priority: TaskPriority;
  count: number;
}

export interface TypeSlice {
  type: TaskType;
  count: number;
}

export interface WorkloadEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  assigned: number;
  completed: number;
}

export interface RecentActivityEntry {
  id: string;
  action: string;
  entityType: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  taskTitle: string | null;
  taskNumber: number | null;
  createdAt: string;
}

export interface ProjectSummary {
  kpis: SummaryKpis;
  total: number;
  statusOverview: StatusSlice[];
  priorityDistribution: PrioritySlice[];
  taskTypes: TypeSlice[];
  teamWorkload: WorkloadEntry[];
  recentActivities: RecentActivityEntry[];
}

export type DeveloperGrade = 'excellent' | 'good' | 'average' | 'poor';

export interface DeveloperRow {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  assigned: number;
  completed: number;
  completionRate: number;
  loggedHours: number;
  avgDuration: number;
  overdue: number;
  productivityScore: number;
  grade: DeveloperGrade;
}

export interface DevReportKpis {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  loggedHours: number;
  overdueTasks: number;
  avgCompletionTime: number;
  productivityScore: number;
}

export interface NamePoint {
  name: string;
  value: number;
}

export interface TaskDetailRow {
  id: string;
  taskNumber: number | null;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedHours: number | null;
  loggedHours: number | null;
  dueDate: string | null;
  completedDate: string | null;
  overdue: boolean;
  lateDays: number;
}

export interface DeveloperReport {
  kpis: DevReportKpis;
  developers: DeveloperRow[];
  taskDistribution: NamePoint[];
  loggedHoursTrend: { week: string; hours: number }[];
  completionTrend: DailyCompletionPoint[];
  overdueAnalysis: NamePoint[];
  taskDetails: TaskDetailRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.IN_REVIEW]: 'Review',
  [TaskStatus.DONE]: 'Delivered',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(WorkingHour)
    private readonly workingHourRepository: Repository<WorkingHour>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async getSummary(projectId: string): Promise<ProjectSummary> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const today = now.toISOString().slice(0, 10);
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS)
      .toISOString()
      .slice(0, 10);

    const base = () =>
      this.taskRepository
        .createQueryBuilder('task')
        .where('task.projectId = :projectId', { projectId });

    const [
      completed,
      updated,
      created,
      dueSoon,
      overdue,
      blocked,
      total,
      statusRows,
      priorityRows,
      typeRows,
      workloadRows,
      activityRows,
    ] = await Promise.all([
      base()
        .andWhere('task.status = :done', { done: TaskStatus.DONE })
        .andWhere('task.updatedAt >= :weekAgo', { weekAgo })
        .getCount(),
      base().andWhere('task.updatedAt >= :weekAgo', { weekAgo }).getCount(),
      base().andWhere('task.createdAt >= :weekAgo', { weekAgo }).getCount(),
      base()
        .andWhere('task.status != :done', { done: TaskStatus.DONE })
        .andWhere('task.dueDate BETWEEN :today AND :weekAhead', {
          today,
          weekAhead,
        })
        .getCount(),
      base()
        .andWhere('task.status != :done', { done: TaskStatus.DONE })
        .andWhere('task.dueDate < :today', { today })
        .getCount(),
      this.countBlocked(projectId),
      base().getCount(),
      base()
        .select('task.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.status')
        .getRawMany<{ status: TaskStatus; count: string }>(),
      base()
        .select('task.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.priority')
        .getRawMany<{ priority: TaskPriority; count: string }>(),
      base()
        .select('task.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.type')
        .getRawMany<{ type: TaskType; count: string }>(),
      this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.assignee', 'assignee')
        .select('assignee.id', 'userId')
        .addSelect('assignee.fullName', 'fullName')
        .addSelect('assignee.avatarUrl', 'avatarUrl')
        .addSelect('COUNT(*)', 'assigned')
        .addSelect('COUNT(*) FILTER (WHERE task.status = :done)', 'completed')
        .where('task.projectId = :projectId', { projectId })
        .andWhere('task.assigneeId IS NOT NULL')
        .setParameter('done', TaskStatus.DONE)
        .groupBy('assignee.id')
        .addGroupBy('assignee.fullName')
        .addGroupBy('assignee.avatarUrl')
        .orderBy('assigned', 'DESC')
        .getRawMany<{
          userId: string;
          fullName: string;
          avatarUrl: string | null;
          assigned: string;
          completed: string;
        }>(),
      this.activityLogRepository
        .createQueryBuilder('log')
        .leftJoin('log.user', 'user')
        .leftJoin(Task, 'task', 'task.id::text = log.entityId')
        .select('log.id', 'id')
        .addSelect('log.action', 'action')
        .addSelect('log.entityType', 'entityType')
        .addSelect('log.userId', 'userId')
        .addSelect('log.createdAt', 'createdAt')
        .addSelect('user.fullName', 'userName')
        .addSelect('user.avatarUrl', 'userAvatar')
        .addSelect('task.title', 'taskTitle')
        .addSelect('task.taskNumber', 'taskNumber')
        .where('log.projectId = :projectId', { projectId })
        .orderBy('log.createdAt', 'DESC')
        .limit(15)
        .getRawMany<{
          id: string;
          action: string;
          entityType: string;
          userId: string;
          createdAt: Date;
          userName: string | null;
          userAvatar: string | null;
          taskTitle: string | null;
          taskNumber: number | null;
        }>(),
    ]);

    return {
      kpis: { completed, updated, created, dueSoon, overdue, blocked },
      total,
      statusOverview: statusRows.map((r) => ({
        status: r.status,
        count: Number(r.count),
      })),
      priorityDistribution: priorityRows.map((r) => ({
        priority: r.priority,
        count: Number(r.count),
      })),
      taskTypes: typeRows.map((r) => ({
        type: r.type,
        count: Number(r.count),
      })),
      teamWorkload: workloadRows.map((r) => ({
        userId: r.userId,
        fullName: r.fullName,
        avatarUrl: r.avatarUrl,
        assigned: Number(r.assigned),
        completed: Number(r.completed),
      })),
      recentActivities: activityRows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        userId: r.userId,
        userName: r.userName,
        userAvatar: r.userAvatar,
        taskTitle: r.taskTitle,
        taskNumber: r.taskNumber === null ? null : Number(r.taskNumber),
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    };
  }

  private async countBlocked(projectId: string): Promise<number> {
    const rows = await this.taskRepository.query(
      `SELECT COUNT(DISTINCT t.id) AS count
         FROM tasks t
         JOIN task_links l
           ON (l.source_task_id = t.id AND l.link_type = 'blocked_by')
           OR (l.target_task_id = t.id AND l.link_type = 'blocks')
        WHERE t.project_id = $1
          AND t.status != $2
          AND t.deleted_at IS NULL`,
      [projectId, TaskStatus.DONE],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getDeveloperReport(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<DeveloperReport> {
    const { from, to } = this.resolveRange(query, 30);
    const today = new Date().toISOString().slice(0, 10);

    // Population: tasks created within range, with an assignee
    const taskQb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.assigneeId IS NOT NULL')
      .andWhere('task.createdAt BETWEEN :from AND :to', { from, to });
    if (query.priority?.length) {
      taskQb.andWhere('task.priority IN (:...priorities)', {
        priorities: query.priority,
      });
    }
    if (query.type?.length) {
      taskQb.andWhere('task.type IN (:...types)', { types: query.type });
    }
    if (query.userId) {
      taskQb.andWhere('task.assigneeId = :userId', { userId: query.userId });
    }
    const tasks = await taskQb.getMany();

    // Logged hours per user within range
    const hoursRows = await this.workingHourRepository
      .createQueryBuilder('wh')
      .innerJoin('wh.task', 'task')
      .select('wh.userId', 'userId')
      .addSelect('wh.loggedDate', 'loggedDate')
      .addSelect('SUM(wh.hours)', 'hours')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('wh.loggedDate BETWEEN :from AND :to', {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      })
      .groupBy('wh.userId')
      .addGroupBy('wh.loggedDate')
      .getRawMany<{ userId: string; loggedDate: string; hours: string }>();

    const loggedByUser = new Map<string, number>();
    const loggedByWeek = new Map<string, number>();
    for (const row of hoursRows) {
      const h = Number(row.hours) || 0;
      loggedByUser.set(row.userId, (loggedByUser.get(row.userId) ?? 0) + h);
      const week = this.isoWeekKey(new Date(row.loggedDate));
      loggedByWeek.set(week, (loggedByWeek.get(week) ?? 0) + h);
    }

    // ── Per-developer aggregation ──
    interface Acc {
      userId: string;
      fullName: string;
      avatarUrl: string | null;
      assigned: number;
      completed: number;
      overdue: number;
      durationDaysSum: number;
      durationCount: number;
      onTimeEligible: number;
      onTime: number;
      estAccSum: number;
      estAccCount: number;
    }
    const devs = new Map<string, Acc>();
    const lateBuckets = { onTime: 0, lt3: 0, d3to7: 0, gt7: 0 };
    const completionByDate = new Map<string, number>();
    const distribution: Record<string, number> = {};
    const taskDetails: TaskDetailRow[] = [];

    for (const t of tasks) {
      const uid = t.assigneeId as string;
      const acc =
        devs.get(uid) ??
        ({
          userId: uid,
          fullName: t.assignee?.fullName ?? 'Unknown',
          avatarUrl: t.assignee?.avatarUrl ?? null,
          assigned: 0,
          completed: 0,
          overdue: 0,
          durationDaysSum: 0,
          durationCount: 0,
          onTimeEligible: 0,
          onTime: 0,
          estAccSum: 0,
          estAccCount: 0,
        } as Acc);

      acc.assigned += 1;
      distribution[t.status] = (distribution[t.status] ?? 0) + 1;

      const isDone = t.status === TaskStatus.DONE;
      const completedDate = isDone
        ? t.updatedAt.toISOString().slice(0, 10)
        : null;
      let lateDays = 0;
      const overdueNow = !isDone && t.dueDate != null && t.dueDate < today;

      if (isDone) {
        acc.completed += 1;
        completionByDate.set(
          completedDate as string,
          (completionByDate.get(completedDate as string) ?? 0) + 1,
        );
        const durationDays = Math.max(
          0,
          (t.updatedAt.getTime() - t.createdAt.getTime()) / DAY_MS,
        );
        acc.durationDaysSum += durationDays;
        acc.durationCount += 1;

        if (t.dueDate) {
          acc.onTimeEligible += 1;
          const diff = Math.round(
            (new Date(completedDate as string).getTime() -
              new Date(t.dueDate).getTime()) /
              DAY_MS,
          );
          if (diff <= 0) {
            acc.onTime += 1;
            lateBuckets.onTime += 1;
          } else {
            lateDays = diff;
            if (diff < 3) lateBuckets.lt3 += 1;
            else if (diff <= 7) lateBuckets.d3to7 += 1;
            else lateBuckets.gt7 += 1;
          }
        }
      } else if (overdueNow) {
        acc.overdue += 1;
        lateDays = Math.round(
          (new Date(today).getTime() -
            new Date(t.dueDate as string).getTime()) /
            DAY_MS,
        );
      }

      if (t.estimatedHours && t.loggedHours && Number(t.estimatedHours) > 0) {
        const est = Number(t.estimatedHours);
        const logged = Number(t.loggedHours);
        const accuracy = Math.max(0, 1 - Math.abs(logged - est) / est);
        acc.estAccSum += accuracy;
        acc.estAccCount += 1;
      }

      devs.set(uid, acc);

      taskDetails.push({
        id: t.id,
        taskNumber: t.taskNumber,
        title: t.title,
        priority: t.priority,
        status: t.status,
        estimatedHours:
          t.estimatedHours === null ? null : Number(t.estimatedHours),
        loggedHours: t.loggedHours === null ? null : Number(t.loggedHours),
        dueDate: t.dueDate,
        completedDate,
        overdue: overdueNow,
        lateDays,
      });
    }

    const developers: DeveloperRow[] = Array.from(devs.values()).map((a) => {
      const completionRate = a.assigned > 0 ? a.completed / a.assigned : 0;
      const loggedHours = loggedByUser.get(a.userId) ?? 0;
      const avgDuration =
        a.durationCount > 0 ? a.durationDaysSum / a.durationCount : 0;
      const onTimeRate =
        a.onTimeEligible > 0 ? a.onTime / a.onTimeEligible : completionRate;
      const estimateAccuracy =
        a.estAccCount > 0 ? a.estAccSum / a.estAccCount : 0.5;
      const loggedScore = Math.min(
        loggedHours / Math.max(a.assigned * 8, 1),
        1,
      );
      const score =
        completionRate * 0.4 +
        loggedScore * 0.25 +
        onTimeRate * 0.2 +
        estimateAccuracy * 0.15;
      const productivityScore = Math.round(score * 100);
      return {
        userId: a.userId,
        fullName: a.fullName,
        avatarUrl: a.avatarUrl,
        assigned: a.assigned,
        completed: a.completed,
        completionRate: Math.round(completionRate * 100),
        loggedHours: Math.round(loggedHours * 10) / 10,
        avgDuration: Math.round(avgDuration * 10) / 10,
        overdue: a.overdue,
        productivityScore,
        grade: this.gradeFor(productivityScore),
      };
    });
    developers.sort((a, b) => b.productivityScore - a.productivityScore);

    // ── Aggregate KPIs ──
    const totalTasks = tasks.length;
    const completedTasks = developers.reduce((s, d) => s + d.completed, 0);
    const overdueTasks = developers.reduce((s, d) => s + d.overdue, 0);
    const totalLogged = Array.from(loggedByUser.values()).reduce(
      (s, h) => s + h,
      0,
    );
    const durationDays = developers.length
      ? developers.reduce((s, d) => s + d.avgDuration, 0) / developers.length
      : 0;
    const avgScore = developers.length
      ? Math.round(
          developers.reduce((s, d) => s + d.productivityScore, 0) /
            developers.length,
        )
      : 0;

    return {
      kpis: {
        totalTasks,
        completedTasks,
        completionRate:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        loggedHours: Math.round(totalLogged * 10) / 10,
        overdueTasks,
        avgCompletionTime: Math.round(durationDays * 10) / 10,
        productivityScore: avgScore,
      },
      developers,
      taskDistribution: (Object.keys(distribution) as TaskStatus[]).map(
        (status) => ({
          name: STATUS_LABEL[status] ?? status,
          value: distribution[status],
        }),
      ),
      loggedHoursTrend: Array.from(loggedByWeek.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, hours]) => ({
          week,
          hours: Math.round(hours * 10) / 10,
        })),
      completionTrend: Array.from(completionByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, completed]) => ({ date, completed })),
      overdueAnalysis: [
        { name: 'On Time', value: lateBuckets.onTime },
        { name: 'Late < 3 days', value: lateBuckets.lt3 },
        { name: 'Late 3-7 days', value: lateBuckets.d3to7 },
        { name: 'Late > 7 days', value: lateBuckets.gt7 },
      ],
      taskDetails,
    };
  }

  private gradeFor(score: number): DeveloperGrade {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  private isoWeekKey(date: Date): string {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  async getWeeklyReport(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<DailyCompletionPoint[]> {
    return this.getCompletionsByDate(projectId, query, 7);
  }

  async getProductivity(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<DailyCompletionPoint[]> {
    return this.getCompletionsByDate(projectId, query, 30);
  }

  async getMonthlyKpi(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<MonthlyKpi> {
    const { from, to } = this.resolveRange(query, 30);

    const totalQb = this.taskRepository
      .createQueryBuilder('task')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.createdAt BETWEEN :from AND :to', { from, to });
    this.applyCommonFilters(totalQb, query);
    const target = await totalQb.getCount();

    const completedQb = this.taskRepository
      .createQueryBuilder('task')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.status = :status', { status: TaskStatus.DONE })
      .andWhere('task.updatedAt BETWEEN :from AND :to', { from, to });
    this.applyCommonFilters(completedQb, query);
    const actual = await completedQb.getCount();

    const completionRate =
      target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      target,
      actual,
      completionRate,
    };
  }

  async getCompletionRate(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<CompletionRateSlice[]> {
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.projectId = :projectId', { projectId });
    this.applyCommonFilters(qb, query);
    qb.groupBy('task.status');

    const rows = await qb.getRawMany<{ status: TaskStatus; count: string }>();
    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
  }

  async getWorkingHours(
    projectId: string,
    query: QueryReportsDto,
  ): Promise<WorkingHoursPoint[]> {
    const { from, to } = this.resolveRange(query, 30);

    const estimatedQb = this.taskRepository
      .createQueryBuilder('task')
      .select('task.assigneeId', 'userId')
      .addSelect('SUM(task.estimatedHours)', 'estimatedHours')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.assigneeId IS NOT NULL');
    if (query.userId) {
      estimatedQb.andWhere('task.assigneeId = :userId', {
        userId: query.userId,
      });
    }
    if (query.sprintId) {
      estimatedQb.andWhere('task.sprintId = :sprintId', {
        sprintId: query.sprintId,
      });
    }
    estimatedQb.groupBy('task.assigneeId');
    const estimatedRows = await estimatedQb.getRawMany<{
      userId: string;
      estimatedHours: string | null;
    }>();

    const loggedQb = this.workingHourRepository
      .createQueryBuilder('workingHour')
      .innerJoin('workingHour.task', 'task')
      .select('workingHour.userId', 'userId')
      .addSelect('SUM(workingHour.hours)', 'loggedHours')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('workingHour.loggedDate BETWEEN :from AND :to', { from, to });
    if (query.userId) {
      loggedQb.andWhere('workingHour.userId = :userId', {
        userId: query.userId,
      });
    }
    if (query.sprintId) {
      loggedQb.andWhere('task.sprintId = :sprintId', {
        sprintId: query.sprintId,
      });
    }
    loggedQb.groupBy('workingHour.userId');
    const loggedRows = await loggedQb.getRawMany<{
      userId: string;
      loggedHours: string | null;
    }>();

    const points = new Map<string, WorkingHoursPoint>();
    for (const row of estimatedRows) {
      points.set(row.userId, {
        userId: row.userId,
        estimatedHours: Number(row.estimatedHours) || 0,
        loggedHours: 0,
      });
    }
    for (const row of loggedRows) {
      const existing = points.get(row.userId) ?? {
        userId: row.userId,
        estimatedHours: 0,
        loggedHours: 0,
      };
      existing.loggedHours = Number(row.loggedHours) || 0;
      points.set(row.userId, existing);
    }

    return Array.from(points.values());
  }

  private async getCompletionsByDate(
    projectId: string,
    query: QueryReportsDto,
    defaultDays: number,
  ): Promise<DailyCompletionPoint[]> {
    const { from, to } = this.resolveRange(query, defaultDays);

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .select("to_char(task.updatedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'completed')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.status = :status', { status: TaskStatus.DONE })
      .andWhere('task.updatedAt BETWEEN :from AND :to', { from, to });
    this.applyCommonFilters(qb, query);
    qb.groupBy("to_char(task.updatedAt, 'YYYY-MM-DD')").orderBy('date', 'ASC');

    const rows = await qb.getRawMany<{ date: string; completed: string }>();
    return rows.map((row) => ({
      date: row.date,
      completed: Number(row.completed),
    }));
  }

  private applyCommonFilters(
    qb: SelectQueryBuilder<Task>,
    query: QueryReportsDto,
  ): void {
    if (query.userId) {
      qb.andWhere('task.assigneeId = :userId', { userId: query.userId });
    }
    if (query.sprintId) {
      qb.andWhere('task.sprintId = :sprintId', { sprintId: query.sprintId });
    }
    if (query.priority?.length) {
      qb.andWhere('task.priority IN (:...priorities)', {
        priorities: query.priority,
      });
    }
    if (query.type?.length) {
      qb.andWhere('task.type IN (:...types)', { types: query.type });
    }
  }

  private resolveRange(
    query: QueryReportsDto,
    defaultDays: number,
  ): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - defaultDays * DAY_MS);
    return { from, to };
  }
}
