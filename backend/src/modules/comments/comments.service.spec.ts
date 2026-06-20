import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityAction, ActivityEntityType } from '@shared/enums';
import { ActivityService } from '@/modules/activity/activity.service';
import { CommentsService } from '@/modules/comments/comments.service';
import { CommentMention } from '@/modules/comments/entities/comment-mention.entity';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';

describe('CommentsService', () => {
  let service: CommentsService;

  const projectId = 'project-1';
  const taskId = 'task-1';
  const authorId = 'author-1';

  let commentRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
  };
  let mentionRepository: { create: jest.Mock; save: jest.Mock };
  let taskRepository: { findOne: jest.Mock };
  let projectMemberRepository: { find: jest.Mock };
  let activityService: { record: jest.Mock };
  let gateway: { emitCommentAdded: jest.Mock };
  let notificationsService: { create: jest.Mock; notifyTaskEvent: jest.Mock };

  const buildComment = (overrides: Partial<Comment> = {}): Comment =>
    Object.assign(new Comment(), {
      id: 'comment-1',
      taskId,
      authorId,
      content: 'Hello',
      parentId: null,
      editedAt: null,
      createdAt: new Date(),
      ...overrides,
    });

  beforeEach(async () => {
    commentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity) => Object.assign(new Comment(), entity)),
      save: jest.fn((entity) =>
        Promise.resolve(
          Object.assign(entity, { id: entity.id ?? 'comment-new' }),
        ),
      ),
      softRemove: jest.fn().mockResolvedValue(undefined),
    };
    mentionRepository = {
      create: jest.fn((entity) => Object.assign(new CommentMention(), entity)),
      save: jest.fn((entities) => Promise.resolve(entities)),
    };
    taskRepository = { findOne: jest.fn() };
    projectMemberRepository = { find: jest.fn() };
    activityService = { record: jest.fn().mockResolvedValue(undefined) };
    gateway = { emitCommentAdded: jest.fn() };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      notifyTaskEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepository },
        {
          provide: getRepositoryToken(CommentMention),
          useValue: mentionRepository,
        },
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: projectMemberRepository,
        },
        { provide: ActivityService, useValue: activityService },
        { provide: TaskboardGateway, useValue: gateway },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('throws when the task does not belong to the project', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(projectId, taskId, authorId, { content: 'Hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a parent comment that does not belong to the task', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      commentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(projectId, taskId, authorId, {
          content: 'Hi',
          parentId: 'other-comment',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects mentioning a user who is not a project member', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      projectMemberRepository.find.mockResolvedValue([]);

      await expect(
        service.create(projectId, taskId, authorId, {
          content: 'Hi @stranger',
          mentionedUserIds: ['stranger-1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a comment, persists mentions, and records activity', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      projectMemberRepository.find.mockResolvedValue([
        { projectId, userId: 'mention-1' },
      ]);
      commentRepository.findOne.mockResolvedValueOnce(
        buildComment({ id: 'comment-new' }),
      );

      const result = await service.create(projectId, taskId, authorId, {
        content: 'Hi @mention-1',
        mentionedUserIds: ['mention-1'],
      });

      expect(mentionRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          commentId: 'comment-new',
          userId: 'mention-1',
        }),
      ]);
      expect(activityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          userId: authorId,
          action: ActivityAction.COMMENTED,
          entityType: ActivityEntityType.COMMENT,
        }),
      );
      expect(result.id).toBe('comment-new');
    });
  });

  describe('update', () => {
    it('rejects editing someone else’s comment', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      commentRepository.findOne.mockResolvedValue(
        buildComment({ authorId: 'someone-else' }),
      );

      await expect(
        service.update(projectId, taskId, 'comment-1', authorId, {
          content: 'edited',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates content and sets editedAt for the author', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      commentRepository.findOne.mockResolvedValue(buildComment());

      const result = await service.update(
        projectId,
        taskId,
        'comment-1',
        authorId,
        { content: 'edited' },
      );

      expect(result.content).toBe('edited');
      expect(result.editedAt).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    it('rejects deleting someone else’s comment', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      commentRepository.findOne.mockResolvedValue(
        buildComment({ authorId: 'someone-else' }),
      );

      await expect(
        service.remove(projectId, taskId, 'comment-1', authorId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('soft-removes the comment for the author', async () => {
      const comment = buildComment();
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      commentRepository.findOne.mockResolvedValue(comment);

      await service.remove(projectId, taskId, 'comment-1', authorId);

      expect(commentRepository.softRemove).toHaveBeenCalledWith(comment);
    });
  });
});
