import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityAction, ActivityEntityType } from '@shared/enums';
import { QueryActivityDto } from '@/modules/activity/dto/query-activity.dto';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';

export interface RecordActivityParams {
  projectId: string;
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface PaginatedActivityLogs {
  data: ActivityLog[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async findAllForProject(
    projectId: string,
    query: QueryActivityDto,
  ): Promise<PaginatedActivityLogs> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 50), 200);

    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .where('log.projectId = :projectId', { projectId })
      .orderBy('log.createdAt', 'DESC');

    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.action?.length) {
      qb.andWhere('log.action IN (:...actions)', { actions: query.action });
    }
    if (query.entityType?.length) {
      qb.andWhere('log.entityType IN (:...entityTypes)', {
        entityTypes: query.entityType,
      });
    }
    if (query.from) {
      qb.andWhere('log.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('log.createdAt <= :to', { to: query.to });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async record(params: RecordActivityParams): Promise<ActivityLog> {
    const log = this.activityLogRepository.create({
      projectId: params.projectId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    return this.activityLogRepository.save(log);
  }
}
