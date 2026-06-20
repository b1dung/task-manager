import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { NotificationType, UserRole } from '@shared/enums';
import { QueryNotificationsDto } from '@/modules/notifications/dto/query-notifications.dto';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';

export interface CreateNotificationParams {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  entityType: string;
  entityId: string;
  message: string;
}

/** A task/project event to fan out to everyone who should know about it. */
export interface TaskEventParams {
  projectId: string;
  actorId: string | null;
  type: NotificationType;
  entityType: string;
  entityId: string;
  message: string;
  /** Directly-involved users (assignee, reporter, mentioned…). */
  directRecipientIds?: (string | null | undefined)[];
  /** Include project admins/managers as recipients (default true). */
  includeProjectManagers?: boolean;
  /** Users who already received a related notification (e.g. a @mention) and
   * should be skipped here to avoid duplicates. */
  excludeRecipientIds?: (string | null | undefined)[];
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly gateway: TaskboardGateway,
  ) {}

  /** Owners (dynamic `owner` role) are watchers of everything. Cached briefly to
   * avoid a roles join on every single event. */
  private ownerIdsCache: { ids: string[]; at: number } | null = null;

  private async getOwnerIds(): Promise<string[]> {
    const now = Date.now();
    if (this.ownerIdsCache && now - this.ownerIdsCache.at < 30_000) {
      return this.ownerIdsCache.ids;
    }
    const rows = await this.userRepository
      .createQueryBuilder('u')
      .innerJoin('roles', 'r', 'r.id = u.role_id')
      .where('r.key = :key', { key: 'owner' })
      .andWhere('u.is_active = true')
      .select('u.id', 'id')
      .getRawMany<{ id: string }>();
    const ids = rows.map((r) => r.id);
    this.ownerIdsCache = { ids, at: now };
    return ids;
  }

  private async getProjectManagerIds(projectId: string): Promise<string[]> {
    const rows = await this.projectMemberRepository.find({
      where: {
        projectId,
        role: In([UserRole.ADMIN, UserRole.MANAGER]),
      },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /**
   * Fan a task/project event out to everyone who should be notified:
   * the directly-involved users + project managers/admins + global owners,
   * de-duplicated, excluding the actor and any inactive accounts.
   */
  async notifyTaskEvent(event: TaskEventParams): Promise<void> {
    const recipients = new Set<string>();
    for (const id of event.directRecipientIds ?? []) {
      if (id) recipients.add(id);
    }
    if (event.includeProjectManagers !== false) {
      for (const id of await this.getProjectManagerIds(event.projectId)) {
        recipients.add(id);
      }
    }
    for (const id of await this.getOwnerIds()) recipients.add(id);
    if (event.actorId) recipients.delete(event.actorId);
    for (const id of event.excludeRecipientIds ?? []) {
      if (id) recipients.delete(id);
    }
    if (recipients.size === 0) return;

    // Drop inactive accounts so we never notify disabled users.
    const active = await this.userRepository.find({
      where: { id: In([...recipients]), isActive: true },
      select: { id: true },
    });
    if (active.length === 0) return;

    await this.createMany(
      active.map((u) => u.id),
      {
        actorId: event.actorId,
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        message: event.message,
      },
    );
  }

  /** Bulk-create notifications for many recipients in one round trip + emit each. */
  async createMany(
    recipientIds: string[],
    params: Omit<CreateNotificationParams, 'recipientId'>,
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    const entities = recipientIds.map((recipientId) =>
      this.notificationRepository.create({
        recipientId,
        actorId: params.actorId ?? null,
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        message: params.message,
        readAt: null,
      }),
    );
    const saved = await this.notificationRepository.save(entities);
    for (const n of saved) this.gateway.emitNotification(n.recipientId, n);
  }

  async findAllForUser(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedNotifications> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.unreadOnly) {
      qb.andWhere('notification.readAt IS NULL');
    }

    const [items, total] = await qb.getManyAndCount();
    await this.attachContext(items);
    const unreadCount = await this.countUnread(userId);

    return { items, total, unreadCount, page, limit };
  }

  /** Resolve the related task/project for each notification so the client can
   * deep-link to the task and show the project name + task id. */
  private async attachContext(items: Notification[]): Promise<void> {
    if (items.length === 0) return;
    const manager = this.notificationRepository.manager;

    // comment notifications reference a comment id → resolve to its task
    const commentIds = items
      .filter((n) => n.entityType === 'comment')
      .map((n) => n.entityId);
    const commentToTask = new Map<string, string>();
    if (commentIds.length > 0) {
      const comments = await manager.find(Comment, {
        where: { id: In(commentIds) },
      });
      for (const c of comments) commentToTask.set(c.id, c.taskId);
    }

    const taskIds = new Set<string>();
    for (const n of items) {
      if (n.entityType === 'task') taskIds.add(n.entityId);
      else if (n.entityType === 'comment') {
        const taskId = commentToTask.get(n.entityId);
        if (taskId) taskIds.add(taskId);
      }
    }

    const taskById = new Map<string, Task>();
    if (taskIds.size > 0) {
      const tasks = await manager.find(Task, {
        where: { id: In([...taskIds]) },
        relations: { project: true },
      });
      for (const t of tasks) taskById.set(t.id, t);
    }

    for (const n of items) {
      let task: Task | undefined;
      if (n.entityType === 'task') task = taskById.get(n.entityId);
      else if (n.entityType === 'comment') {
        const taskId = commentToTask.get(n.entityId);
        if (taskId) task = taskById.get(taskId);
      }
      n.context = task
        ? {
            projectId: task.projectId,
            projectName: task.project?.name ?? null,
            taskId: task.id,
            taskNumber: task.taskNumber,
            taskTitle: task.title,
          }
        : null;
    }
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientId: userId, readAt: IsNull() },
    });
  }

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, recipientId: userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'now()' })
      .where('recipient_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
  }

  async create(params: CreateNotificationParams): Promise<Notification> {
    const notification = this.notificationRepository.create({
      recipientId: params.recipientId,
      actorId: params.actorId ?? null,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      message: params.message,
      readAt: null,
    });
    const saved = await this.notificationRepository.save(notification);
    this.gateway.emitNotification(params.recipientId, saved);
    return saved;
  }
}
