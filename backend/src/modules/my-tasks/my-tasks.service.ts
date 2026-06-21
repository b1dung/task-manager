import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { TaskStatus } from '@shared/enums';
import { Task } from '@/modules/tasks/entities/task.entity';

export interface MyTasksQuery {
  scope?: 'assigned' | 'reported';
  q?: string;
  status?: string;
  priority?: string;
  projectId?: string;
}

export interface MyTaskStats {
  total: number;
  dueToday: number;
  overdue: number;
  completed: number;
  inProgress: number;
}

@Injectable()
export class MyTasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async findForUser(
    userId: string,
    query: MyTasksQuery,
  ): Promise<{ items: Task[]; stats: MyTaskStats }> {
    const scope = query.scope ?? 'assigned';
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.labels', 'label')
      .where('task.archivedAt IS NULL')
      .andWhere('task.parentTaskId IS NULL');

    if (scope === 'reported') {
      qb.andWhere('task.reporterId = :userId', { userId });
    } else {
      qb.andWhere('task.assigneeId = :userId', { userId });
    }
    if (query.projectId) {
      qb.andWhere('task.projectId = :projectId', {
        projectId: query.projectId,
      });
    }
    if (query.status) {
      qb.andWhere('task.status IN (:...statuses)', {
        statuses: query.status.split(','),
      });
    }
    if (query.priority) {
      qb.andWhere('task.priority IN (:...priorities)', {
        priorities: query.priority.split(','),
      });
    }
    if (query.q) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('task.title ILIKE :q', { q: `%${query.q}%` }).orWhere(
            'task.description ILIKE :q',
            { q: `%${query.q}%` },
          );
        }),
      );
    }

    const items = await qb.orderBy('task.updatedAt', 'DESC').getMany();
    const stats = await this.computeStats(userId);
    return { items, stats };
  }

  /** Stats are always about tasks assigned to the user. */
  private async computeStats(userId: string): Promise<MyTaskStats> {
    const rows = await this.taskRepository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect("TO_CHAR(task.due_date, 'YYYY-MM-DD')", 'dueDate')
      .where('task.assigneeId = :userId', { userId })
      .andWhere('task.archivedAt IS NULL')
      .getRawMany<{ status: string; dueDate: string | null }>();

    const today = new Date().toISOString().slice(0, 10);
    const stats: MyTaskStats = {
      total: rows.length,
      dueToday: 0,
      overdue: 0,
      completed: 0,
      inProgress: 0,
    };
    for (const r of rows) {
      const done = r.status === TaskStatus.DONE;
      if (done) stats.completed += 1;
      if (r.status === TaskStatus.IN_PROGRESS) stats.inProgress += 1;
      if (r.dueDate) {
        if (r.dueDate === today) stats.dueToday += 1;
        else if (r.dueDate < today && !done) stats.overdue += 1;
      }
    }
    return stats;
  }
}
