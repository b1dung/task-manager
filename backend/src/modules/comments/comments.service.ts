import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ActivityAction,
  ActivityEntityType,
  NotificationType,
} from '@shared/enums';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { ActivityService } from '@/modules/activity/activity.service';
import { CommentMention } from '@/modules/comments/entities/comment-mention.entity';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(CommentMention)
    private readonly commentMentionRepository: Repository<CommentMention>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    private readonly activityService: ActivityService,
    private readonly gateway: TaskboardGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAllForTask(projectId: string, taskId: string): Promise<Comment[]> {
    await this.assertTaskInProject(projectId, taskId);
    return this.commentRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    projectId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const task = await this.assertTaskInProject(projectId, taskId);

    if (dto.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: dto.parentId, taskId },
      });
      if (!parent) {
        throw new BadRequestException(
          'Parent comment does not belong to this task',
        );
      }
    }

    const mentionedUserIds = Array.from(new Set(dto.mentionedUserIds ?? []));
    if (mentionedUserIds.length) {
      const members = await this.projectMemberRepository.find({
        where: { projectId, userId: In(mentionedUserIds) },
      });
      if (members.length !== mentionedUserIds.length) {
        throw new BadRequestException(
          'One or more mentioned users are not members of this project',
        );
      }
    }

    const comment = this.commentRepository.create({
      taskId,
      authorId,
      content: dto.content,
      parentId: dto.parentId ?? null,
    });
    const saved = await this.commentRepository.save(comment);

    if (mentionedUserIds.length) {
      const mentions = mentionedUserIds.map((userId) =>
        this.commentMentionRepository.create({ commentId: saved.id, userId }),
      );
      await this.commentMentionRepository.save(mentions);
    }

    await this.activityService.record({
      projectId,
      userId: authorId,
      action: ActivityAction.COMMENTED,
      entityType: ActivityEntityType.COMMENT,
      entityId: saved.id,
      newValues: { taskId, content: saved.content },
    });

    const result = await this.findOneOrFail(taskId, saved.id);
    this.gateway.emitCommentAdded(taskId, result);

    // @mentions are personal — notify the mentioned users (+ owners), not the
    // whole project management.
    const mentioned = mentionedUserIds.filter((id) => id !== authorId);
    if (mentioned.length > 0) {
      await this.notificationsService.notifyTaskEvent({
        projectId,
        actorId: authorId,
        type: NotificationType.MENTION,
        entityType: 'comment',
        entityId: saved.id,
        message: `mentioned you in a comment on "${task.title}"`,
        directRecipientIds: mentioned,
        includeProjectManagers: false,
      });
    }

    // The comment itself fans out to the task's people + project managers +
    // owners, skipping anyone already pinged by a @mention above.
    await this.notificationsService.notifyTaskEvent({
      projectId,
      actorId: authorId,
      type: NotificationType.COMMENT_ADDED,
      entityType: 'comment',
      entityId: saved.id,
      message: `commented on "${task.title}"`,
      directRecipientIds: [task.assigneeId, task.reporterId],
      excludeRecipientIds: mentioned,
    });

    return result;
  }

  async update(
    projectId: string,
    taskId: string,
    id: string,
    requesterId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    await this.assertTaskInProject(projectId, taskId);
    const comment = await this.findOneOrFail(taskId, id);
    if (comment.authorId !== requesterId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = dto.content;
    comment.editedAt = new Date();
    return this.commentRepository.save(comment);
  }

  async remove(
    projectId: string,
    taskId: string,
    id: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertTaskInProject(projectId, taskId);
    const comment = await this.findOneOrFail(taskId, id);
    if (comment.authorId !== requesterId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.commentRepository.softRemove(comment);
  }

  private async findOneOrFail(taskId: string, id: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private async assertTaskInProject(
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }
    return task;
  }
}
