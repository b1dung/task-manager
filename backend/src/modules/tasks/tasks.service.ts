import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { Label } from '@/modules/labels/entities/label.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { CreateTaskLinkDto } from '@/modules/tasks/dto/create-task-link.dto';
import { CreateTaskDto } from '@/modules/tasks/dto/create-task.dto';
import { MoveTaskDto } from '@/modules/tasks/dto/move-task.dto';
import { DueFilter, QueryTasksDto } from '@/modules/tasks/dto/query-tasks.dto';
import { UpdateTaskDto } from '@/modules/tasks/dto/update-task.dto';
import { TaskLink } from '@/modules/tasks/entities/task-link.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';
import {
  NotificationType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@shared/enums';

export interface PaginatedTasks {
  data: Task[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskLink)
    private readonly taskLinkRepository: Repository<TaskLink>,
    @InjectRepository(BoardColumn)
    private readonly columnRepository: Repository<BoardColumn>,
    @InjectRepository(Sprint)
    private readonly sprintRepository: Repository<Sprint>,
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    private readonly gateway: TaskboardGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    projectId: string,
    query: QueryTasksDto,
  ): Promise<PaginatedTasks> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 50), 200);

    const qb = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.labels', 'label')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.projectId = :projectId', { projectId });

    // ── Subtask visibility ────────────────────────────────────────────────
    if (query.includeSubtasks === false) {
      qb.andWhere('task.parentTaskId IS NULL');
    }

    // ── Multi-value enum filters ──────────────────────────────────────────
    if (query.status?.length) {
      qb.andWhere('task.status IN (:...statuses)', { statuses: query.status });
    }
    if (query.priority?.length) {
      qb.andWhere('task.priority IN (:...priorities)', {
        priorities: query.priority,
      });
    }
    if (query.type?.length) {
      qb.andWhere('task.type IN (:...types)', { types: query.type });
    }

    // ── UUID filters ──────────────────────────────────────────────────────
    if (query.assigneeId?.length) {
      qb.andWhere('task.assigneeId IN (:...assigneeIds)', {
        assigneeIds: query.assigneeId,
      });
    }
    if (query.reporterId) {
      qb.andWhere('task.reporterId = :reporterId', {
        reporterId: query.reporterId,
      });
    }
    if (query.sprintId?.length) {
      qb.andWhere('task.sprintId IN (:...sprintIds)', {
        sprintIds: query.sprintId,
      });
    }
    if (query.labelId?.length) {
      qb.andWhere('label.id IN (:...labelIds)', { labelIds: query.labelId });
    }

    // ── Due-date shortcut ─────────────────────────────────────────────────
    if (query.due) {
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);
      const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000 - 1);

      switch (query.due) {
        case DueFilter.OVERDUE:
          qb.andWhere('task.dueDate IS NOT NULL').andWhere(
            'task.dueDate < :startOfToday',
            { startOfToday },
          );
          break;
        case DueFilter.TODAY:
          qb.andWhere('task.dueDate BETWEEN :startOfToday AND :endOfToday', {
            startOfToday,
            endOfToday,
          });
          break;
        case DueFilter.THIS_WEEK:
          qb.andWhere('task.dueDate BETWEEN :startOfToday AND :endOfWeek', {
            startOfToday,
            endOfWeek,
          });
          break;
        case DueFilter.NO_DUE_DATE:
          qb.andWhere('task.dueDate IS NULL');
          break;
      }
    }

    // ── Date range filters ────────────────────────────────────────────────
    if (query.createdFrom) {
      qb.andWhere('task.createdAt >= :createdFrom', {
        createdFrom: query.createdFrom,
      });
    }
    if (query.createdTo) {
      qb.andWhere('task.createdAt <= :createdTo', {
        createdTo: query.createdTo,
      });
    }
    if (query.updatedFrom) {
      qb.andWhere('task.updatedAt >= :updatedFrom', {
        updatedFrom: query.updatedFrom,
      });
    }
    if (query.updatedTo) {
      qb.andWhere('task.updatedAt <= :updatedTo', {
        updatedTo: query.updatedTo,
      });
    }

    // ── Hours range filters ───────────────────────────────────────────────
    if (query.estimatedHoursMin !== undefined) {
      qb.andWhere('task.estimatedHours >= :estimatedHoursMin', {
        estimatedHoursMin: query.estimatedHoursMin,
      });
    }
    if (query.estimatedHoursMax !== undefined) {
      qb.andWhere('task.estimatedHours <= :estimatedHoursMax', {
        estimatedHoursMax: query.estimatedHoursMax,
      });
    }
    if (query.loggedHoursMin !== undefined) {
      qb.andWhere('task.loggedHours >= :loggedHoursMin', {
        loggedHoursMin: query.loggedHoursMin,
      });
    }
    if (query.loggedHoursMax !== undefined) {
      qb.andWhere('task.loggedHours <= :loggedHoursMax', {
        loggedHoursMax: query.loggedHoursMax,
      });
    }

    // ── Boolean filters ───────────────────────────────────────────────────
    if (query.hasAttachment === true) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM attachments a WHERE a.task_id = task.id)',
      );
    } else if (query.hasAttachment === false) {
      qb.andWhere(
        'NOT EXISTS (SELECT 1 FROM attachments a WHERE a.task_id = task.id)',
      );
    }
    if (query.hasSubtask === true) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM tasks sub WHERE sub.parent_task_id = task.id AND sub.deleted_at IS NULL)',
      );
    } else if (query.hasSubtask === false) {
      qb.andWhere(
        'NOT EXISTS (SELECT 1 FROM tasks sub WHERE sub.parent_task_id = task.id AND sub.deleted_at IS NULL)',
      );
    }

    // ── Full-text search ──────────────────────────────────────────────────
    if (query.q) {
      qb.andWhere(
        '(task.title ILIKE :q OR task.description ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    // ── Sorting ───────────────────────────────────────────────────────────
    const sortMap: Record<string, string> = {
      position: 'task.position',
      createdAt: 'task.createdAt',
      updatedAt: 'task.updatedAt',
      dueDate: 'task.dueDate',
      priority: 'task.priority',
      title: 'task.title',
    };
    const sortCol = sortMap[query.sort ?? 'position'] ?? 'task.position';
    const order = query.order === 'DESC' ? 'DESC' : 'ASC';

    if (query.sort === 'position' || !query.sort) {
      qb.orderBy('task.columnId', 'ASC').addOrderBy(sortCol, order);
    } else {
      qb.orderBy(sortCol, order);
    }

    // ── Pagination ────────────────────────────────────────────────────────
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Attach subtask_count + subtasks_preview when filtering parent-only
    if (query.includeSubtasks === false && data.length > 0) {
      const parentIds = data.map((t) => t.id);
      const subtasks = await this.taskRepository.find({
        where: { parentTaskId: In(parentIds) },
        select: { id: true, title: true, status: true, assigneeId: true, parentTaskId: true, taskNumber: true },
        relations: { assignee: true },
      });
      const byParent = new Map<string, Task[]>();
      for (const s of subtasks) {
        const arr = byParent.get(s.parentTaskId!) ?? [];
        arr.push(s);
        byParent.set(s.parentTaskId!, arr);
      }
      for (const task of data) {
        const children = byParent.get(task.id) ?? [];
        task.subtaskCount = children.length;
        task.doneSubtaskCount = children.filter((c) => c.status === 'done').length;
        task.subtasksPreview = children;
      }
    }

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(projectId: string, id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id, projectId },
      relations: { labels: true, subtasks: true, parentTask: true, assignee: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    // Attach subtask count for card display
    task.subtaskCount = (task.subtasks ?? []).length;
    return task;
  }

  async create(
    projectId: string,
    reporterId: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    const column = await this.columnRepository.findOne({
      where: { id: dto.columnId, projectId },
    });
    if (!column) {
      throw new BadRequestException('Column does not belong to this project');
    }
    if (dto.assigneeId) {
      await this.assertProjectMember(projectId, dto.assigneeId);
    }
    if (dto.sprintId) {
      await this.assertSprintInProject(projectId, dto.sprintId);
    }
    if (dto.parentTaskId) {
      await this.assertTaskInProject(projectId, dto.parentTaskId);
    }
    const labels = dto.labelIds?.length
      ? await this.resolveLabels(projectId, dto.labelIds)
      : [];

    const { max } = (await this.taskRepository
      .createQueryBuilder('task')
      .select('COALESCE(MAX(task.position), -1)', 'max')
      .where('task.columnId = :columnId', { columnId: dto.columnId })
      .getRawOne<{ max: string }>())!;

    const { maxNum } = (await this.taskRepository
      .createQueryBuilder('task')
      .select('COALESCE(MAX(task.taskNumber), 0)', 'maxNum')
      .where('task.projectId = :projectId', { projectId })
      .withDeleted()
      .getRawOne<{ maxNum: string }>())!;

    const task = this.taskRepository.create({
      projectId,
      columnId: dto.columnId,
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? TaskType.TASK,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      assigneeId: dto.assigneeId ?? null,
      reporterId,
      sprintId: dto.sprintId ?? null,
      parentTaskId: dto.parentTaskId ?? null,
      dueDate: dto.dueDate ?? null,
      estimatedHours: dto.estimatedHours ?? null,
      storyPoints: dto.storyPoints ?? null,
      position: Number(max) + 1,
      taskNumber: Number(maxNum) + 1,
      labels,
    });
    const saved = await this.taskRepository.save(task);
    const created = await this.findById(projectId, saved.id);

    this.gateway.emitTaskCreated(projectId, created);
    if (created.assigneeId && created.assigneeId !== reporterId) {
      await this.notificationsService.create({
        recipientId: created.assigneeId,
        actorId: reporterId,
        type: NotificationType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: created.id,
        message: `You were assigned to "${created.title}"`,
      });
    }

    return created;
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateTaskDto,
    actorId: string,
  ): Promise<Task> {
    const task = await this.findById(projectId, id);
    const previousAssigneeId = task.assigneeId;

    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        await this.assertProjectMember(projectId, dto.assigneeId);
      }
      task.assigneeId = dto.assigneeId;
      // Clear the loaded relation object so TypeORM uses assigneeId column value on save.
      // Without this, TypeORM prefers the stale relation entity's id over the new assigneeId.
      task.assignee = null;
    }
    if (dto.sprintId !== undefined) {
      if (dto.sprintId) {
        await this.assertSprintInProject(projectId, dto.sprintId);
      }
      task.sprintId = dto.sprintId;
    }
    if (dto.parentTaskId !== undefined) {
      if (dto.parentTaskId) {
        await this.assertTaskInProject(projectId, dto.parentTaskId);
      }
      task.parentTaskId = dto.parentTaskId;
    }
    if (dto.labelIds !== undefined) {
      task.labels = dto.labelIds.length
        ? await this.resolveLabels(projectId, dto.labelIds)
        : [];
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.type !== undefined) task.type = dto.type;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.status !== undefined && dto.status !== task.status) {
      task.status = dto.status;
      // Auto-move to the matching column so the board stays in sync
      const projectCols = await this.columnRepository.find({
        where: { projectId },
        order: { position: 'ASC' },
      });
      const targetCol = projectCols.find(
        (c) => this.columnNameToStatus(c.name) === dto.status,
      );
      if (targetCol && targetCol.id !== task.columnId) {
        const positionInTarget = await this.taskRepository.count({
          where: { columnId: targetCol.id },
        });
        task.columnId = targetCol.id;
        task.position = positionInTarget;
      }
    } else if (dto.status !== undefined) {
      task.status = dto.status;
    }
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    if (dto.estimatedHours !== undefined)
      task.estimatedHours = dto.estimatedHours;
    if (dto.loggedHours !== undefined) task.loggedHours = dto.loggedHours;
    if (dto.storyPoints !== undefined) task.storyPoints = dto.storyPoints;

    await this.taskRepository.save(task);
    const updated = await this.findById(projectId, id);

    this.gateway.emitTaskUpdated(projectId, updated);
    if (
      updated.assigneeId &&
      updated.assigneeId !== previousAssigneeId &&
      updated.assigneeId !== actorId
    ) {
      await this.notificationsService.create({
        recipientId: updated.assigneeId,
        actorId,
        type: NotificationType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: updated.id,
        message: `You were assigned to "${updated.title}"`,
      });
    }

    return updated;
  }

  async remove(projectId: string, id: string, actorId: string): Promise<void> {
    const task = await this.findById(projectId, id);
    await this.taskRepository.softRemove(task);
    this.gateway.emitTaskDeleted(projectId, task.id);

    if (task.assigneeId && task.assigneeId !== actorId) {
      await this.notificationsService.create({
        recipientId: task.assigneeId,
        actorId,
        type: NotificationType.TASK_UPDATED,
        entityType: 'task',
        entityId: task.id,
        message: `"${task.title}" was deleted`,
      });
    }
  }

  async move(
    projectId: string,
    id: string,
    dto: MoveTaskDto,
    actorId: string,
  ): Promise<Task> {
    const task = await this.findById(projectId, id);
    const targetColumn = await this.columnRepository.findOne({
      where: { id: dto.columnId, projectId },
    });
    if (!targetColumn) {
      throw new BadRequestException('Column does not belong to this project');
    }

    if (task.columnId === dto.columnId) {
      await this.reorderWithinColumn(task, dto.position);
    } else {
      await this.moveAcrossColumns(task, dto.columnId, dto.position, targetColumn);
    }

    const moved = await this.findById(projectId, id);
    this.gateway.emitTaskMoved(projectId, moved);
    if (moved.assigneeId && moved.assigneeId !== actorId) {
      await this.notificationsService.create({
        recipientId: moved.assigneeId,
        actorId,
        type: NotificationType.TASK_MOVED,
        entityType: 'task',
        entityId: moved.id,
        message: `"${moved.title}" was moved to ${targetColumn.name}`,
      });
    }

    return moved;
  }

  async logTime(
    projectId: string,
    id: string,
    hours: number,
    actorId: string,
  ): Promise<Task> {
    const task = await this.findById(projectId, id);
    const base = Number(task.loggedHours) || 0;
    const newLogged = Math.max(0, base + hours);
    await this.taskRepository.update(id, { loggedHours: newLogged });
    return this.findById(projectId, id);
  }

  private async reorderWithinColumn(
    task: Task,
    targetPosition: number,
  ): Promise<void> {
    const siblings = await this.taskRepository.find({
      where: { columnId: task.columnId },
      order: { position: 'ASC' },
    });
    const others = siblings.filter((sibling) => sibling.id !== task.id);
    const clampedPosition = Math.min(
      Math.max(targetPosition, 0),
      others.length,
    );
    others.splice(clampedPosition, 0, task);

    await Promise.all(
      others.map((sibling, index) =>
        this.taskRepository.update(sibling.id, { position: index }),
      ),
    );
  }

  private columnNameToStatus(name?: string | null): TaskStatus {
    const n = (name ?? '').toLowerCase();
    if (n.includes('done') || n.includes('complete') || n.includes('closed'))
      return TaskStatus.DONE;
    if (n.includes('review') || n.includes('testing') || n.includes('qa'))
      return TaskStatus.IN_REVIEW;
    if (
      n.includes('progress') ||
      n.includes('doing') ||
      n.includes('active') ||
      n.includes('wip')
    )
      return TaskStatus.IN_PROGRESS;
    return TaskStatus.TODO;
  }

  private async moveAcrossColumns(
    task: Task,
    targetColumnId: string,
    targetPosition: number,
    targetColumn?: BoardColumn,
  ): Promise<void> {
    const sourceSiblings = await this.taskRepository.find({
      where: { columnId: task.columnId },
      order: { position: 'ASC' },
    });
    const remainingSource = sourceSiblings.filter(
      (sibling) => sibling.id !== task.id,
    );

    const targetSiblings = await this.taskRepository.find({
      where: { columnId: targetColumnId },
      order: { position: 'ASC' },
    });
    const clampedPosition = Math.min(
      Math.max(targetPosition, 0),
      targetSiblings.length,
    );
    targetSiblings.splice(clampedPosition, 0, task);

    const newStatus = targetColumn
      ? this.columnNameToStatus(targetColumn.name)
      : task.status;

    await Promise.all([
      ...remainingSource.map((sibling, index) =>
        this.taskRepository.update(sibling.id, { position: index }),
      ),
      ...targetSiblings.map((sibling, index) =>
        this.taskRepository.update(sibling.id, {
          position: index,
          ...(sibling.id === task.id
            ? { columnId: targetColumnId, status: newStatus }
            : {}),
        }),
      ),
    ]);
  }

  async findLinks(projectId: string, taskId: string): Promise<TaskLink[]> {
    const task = await this.findById(projectId, taskId);
    return this.taskLinkRepository.find({
      where: [{ sourceTaskId: task.id }, { targetTaskId: task.id }],
      relations: { sourceTask: true, targetTask: true },
    });
  }

  async addLink(
    projectId: string,
    taskId: string,
    dto: CreateTaskLinkDto,
  ): Promise<TaskLink> {
    const task = await this.findById(projectId, taskId);
    if (dto.targetTaskId === task.id) {
      throw new BadRequestException('A task cannot be linked to itself');
    }
    await this.assertTaskInProject(projectId, dto.targetTaskId);

    const existing = await this.taskLinkRepository.findOne({
      where: {
        sourceTaskId: task.id,
        targetTaskId: dto.targetTaskId,
        linkType: dto.linkType,
      },
    });
    if (existing) {
      throw new ConflictException('This link already exists');
    }

    const link = this.taskLinkRepository.create({
      sourceTaskId: task.id,
      targetTaskId: dto.targetTaskId,
      linkType: dto.linkType,
    });
    return this.taskLinkRepository.save(link);
  }

  async removeLink(
    projectId: string,
    taskId: string,
    linkId: string,
  ): Promise<void> {
    const task = await this.findById(projectId, taskId);
    const link = await this.taskLinkRepository.findOne({
      where: { id: linkId },
    });
    if (
      !link ||
      (link.sourceTaskId !== task.id && link.targetTaskId !== task.id)
    ) {
      throw new NotFoundException('Task link not found');
    }
    await this.taskLinkRepository.remove(link);
  }

  private async assertProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });
    if (!member) {
      throw new BadRequestException(
        'Assignee must be a member of this project',
      );
    }
  }

  private async assertSprintInProject(
    projectId: string,
    sprintId: string,
  ): Promise<void> {
    const sprint = await this.sprintRepository.findOne({
      where: { id: sprintId, projectId },
    });
    if (!sprint) {
      throw new BadRequestException('Sprint does not belong to this project');
    }
  }

  private async assertTaskInProject(
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new BadRequestException('Task does not belong to this project');
    }
  }

  private async resolveLabels(
    projectId: string,
    labelIds: string[],
  ): Promise<Label[]> {
    const uniqueIds = Array.from(new Set(labelIds));
    const labels = await this.labelRepository.find({
      where: { id: In(uniqueIds), projectId },
    });
    if (labels.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more labels do not belong to this project',
      );
    }
    return labels;
  }
}
