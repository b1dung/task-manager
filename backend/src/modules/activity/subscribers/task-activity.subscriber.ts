import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  Repository,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { ActivityAction, ActivityEntityType } from '@shared/enums';
import { RequestContextService } from '@/common/context/request-context.service';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

const TRACKED_FIELDS: ReadonlyArray<keyof Task> = [
  'title',
  'description',
  'status',
  'priority',
  'type',
  'assigneeId',
  'sprintId',
  'columnId',
  'dueDate',
  'storyPoints',
];

interface ActivitySnapshot {
  projectId: string;
  action: ActivityAction;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

@Injectable()
@EventSubscriber()
export class TaskActivitySubscriber implements EntitySubscriberInterface<Task> {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly requestContext: RequestContextService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo(): typeof Task {
    return Task;
  }

  async afterInsert(event: InsertEvent<Task>): Promise<void> {
    const task = event.entity;
    if (!task) {
      return;
    }
    await this.persist(event.manager.getRepository(ActivityLog), {
      projectId: task.projectId,
      action: ActivityAction.CREATED,
      entityId: task.id,
      newValues: {
        title: task.title,
        status: task.status,
        columnId: task.columnId,
      },
    });
  }

  async afterUpdate(event: UpdateEvent<Task>): Promise<void> {
    const task = event.entity as Task | undefined;
    if (!task?.id) {
      return;
    }

    const before = event.databaseEntity as Partial<Task> | undefined;
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    for (const field of TRACKED_FIELDS) {
      const newValue = task[field] ?? null;
      if (!before) {
        newValues[field] = newValue;
        continue;
      }
      const oldValue = before[field] ?? null;
      if (oldValue !== newValue) {
        oldValues[field] = oldValue;
        newValues[field] = newValue;
      }
    }

    if (Object.keys(newValues).length === 0) {
      return;
    }

    let action = ActivityAction.UPDATED;
    if ('columnId' in newValues) {
      action = ActivityAction.MOVED;
    } else if ('assigneeId' in newValues) {
      action = ActivityAction.ASSIGNED;
    } else if ('status' in newValues) {
      action = ActivityAction.STATUS_CHANGED;
    }

    await this.persist(event.manager.getRepository(ActivityLog), {
      projectId: task.projectId ?? before?.projectId ?? '',
      action,
      entityId: task.id,
      oldValues,
      newValues,
    });
  }

  async afterSoftRemove(event: SoftRemoveEvent<Task>): Promise<void> {
    const task = event.entity;
    if (!task) {
      return;
    }
    await this.persist(event.manager.getRepository(ActivityLog), {
      projectId: task.projectId,
      action: ActivityAction.DELETED,
      entityId: task.id,
      oldValues: { title: task.title },
    });
  }

  private async persist(
    repository: Repository<ActivityLog>,
    snapshot: ActivitySnapshot,
  ): Promise<void> {
    const userId = this.requestContext.userId;
    if (!userId || !snapshot.projectId) {
      return;
    }

    const log = repository.create({
      projectId: snapshot.projectId,
      userId,
      action: snapshot.action,
      entityType: ActivityEntityType.TASK,
      entityId: snapshot.entityId,
      oldValues: snapshot.oldValues ?? null,
      newValues: snapshot.newValues ?? null,
      ipAddress: this.requestContext.ipAddress,
    });
    await repository.save(log);
  }
}
