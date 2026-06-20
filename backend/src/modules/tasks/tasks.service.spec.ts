import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  TaskLinkType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@shared/enums';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { Label } from '@/modules/labels/entities/label.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { TaskLink } from '@/modules/tasks/entities/task-link.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TasksService } from '@/modules/tasks/tasks.service';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';

describe('TasksService', () => {
  let service: TasksService;

  const projectId = 'project-1';
  const reporterId = 'reporter-1';

  let taskRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { query: jest.Mock };
  };
  let taskLinkRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let columnRepository: { findOne: jest.Mock };
  let sprintRepository: { findOne: jest.Mock };
  let labelRepository: { find: jest.Mock };
  let projectMemberRepository: { findOne: jest.Mock };
  let gateway: {
    emitTaskCreated: jest.Mock;
    emitTaskUpdated: jest.Mock;
    emitTaskMoved: jest.Mock;
    emitTaskDeleted: jest.Mock;
  };
  let notificationsService: { create: jest.Mock; notifyTaskEvent: jest.Mock };

  const buildTask = (overrides: Partial<Task> = {}): Task =>
    Object.assign(new Task(), {
      id: 'task-1',
      projectId,
      columnId: 'col-1',
      title: 'Task',
      description: null,
      type: TaskType.TASK,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      assigneeId: null,
      reporterId,
      sprintId: null,
      parentTaskId: null,
      dueDate: null,
      estimatedHours: null,
      loggedHours: null,
      storyPoints: null,
      position: 0,
      labels: [],
      ...overrides,
    });

  const buildQueryBuilder = (rawResult: { max: string }) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawResult),
    getMany: jest.fn().mockResolvedValue([]),
  });

  beforeEach(async () => {
    taskRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity) => Object.assign(new Task(), entity)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => buildQueryBuilder({ max: '-1' })),
      manager: { query: jest.fn().mockResolvedValue([{ last_number: 1 }]) },
    };
    taskLinkRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity) => Object.assign(new TaskLink(), entity)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    columnRepository = { findOne: jest.fn() };
    sprintRepository = { findOne: jest.fn() };
    labelRepository = { find: jest.fn() };
    projectMemberRepository = { findOne: jest.fn() };
    gateway = {
      emitTaskCreated: jest.fn(),
      emitTaskUpdated: jest.fn(),
      emitTaskMoved: jest.fn(),
      emitTaskDeleted: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      notifyTaskEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        { provide: getRepositoryToken(TaskLink), useValue: taskLinkRepository },
        {
          provide: getRepositoryToken(BoardColumn),
          useValue: columnRepository,
        },
        { provide: getRepositoryToken(Sprint), useValue: sprintRepository },
        { provide: getRepositoryToken(Label), useValue: labelRepository },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: projectMemberRepository,
        },
        { provide: TaskboardGateway, useValue: gateway },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  describe('create', () => {
    it('rejects a column that does not belong to the project', async () => {
      columnRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(projectId, reporterId, {
          title: 'New task',
          columnId: 'other-col',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a task at the end of the column and resolves relations', async () => {
      columnRepository.findOne.mockResolvedValue({ id: 'col-1', projectId });
      projectMemberRepository.findOne.mockResolvedValue({
        projectId,
        userId: 'assignee-1',
      });
      sprintRepository.findOne.mockResolvedValue({ id: 'sprint-1', projectId });
      labelRepository.find.mockResolvedValue([{ id: 'label-1', projectId }]);
      taskRepository.createQueryBuilder.mockReturnValue(
        buildQueryBuilder({ max: '2' }),
      );
      taskRepository.findOne.mockResolvedValue(
        buildTask({ id: 'task-new', position: 3 }),
      );

      const result = await service.create(projectId, reporterId, {
        title: 'New task',
        columnId: 'col-1',
        assigneeId: 'assignee-1',
        sprintId: 'sprint-1',
        labelIds: ['label-1'],
      });

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 3,
          reporterId,
          status: TaskStatus.TODO,
        }),
      );
      expect(result.id).toBe('task-new');
    });

    it('rejects an assignee who is not a project member', async () => {
      columnRepository.findOne.mockResolvedValue({ id: 'col-1', projectId });
      projectMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(projectId, reporterId, {
          title: 'New task',
          columnId: 'col-1',
          assigneeId: 'stranger',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects label IDs that do not belong to the project', async () => {
      columnRepository.findOne.mockResolvedValue({ id: 'col-1', projectId });
      labelRepository.find.mockResolvedValue([]);

      await expect(
        service.create(projectId, reporterId, {
          title: 'New task',
          columnId: 'col-1',
          labelIds: ['label-x'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('move', () => {
    it('rejects moving to a column from another project', async () => {
      taskRepository.findOne.mockResolvedValue(buildTask());
      columnRepository.findOne.mockResolvedValue(null);

      await expect(
        service.move(
          projectId,
          'task-1',
          { columnId: 'foreign-col', position: 0 },
          reporterId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reorders siblings within the same column', async () => {
      const task = buildTask({ id: 'task-2', columnId: 'col-1', position: 2 });
      const siblings = [
        buildTask({ id: 'task-1', columnId: 'col-1', position: 0 }),
        buildTask({ id: 'task-3', columnId: 'col-1', position: 1 }),
        task,
      ];

      taskRepository.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve([...siblings].find((t) => t.id === where.id) ?? null),
      );
      columnRepository.findOne.mockResolvedValue({ id: 'col-1', projectId });
      taskRepository.find.mockResolvedValue(
        siblings.map((t) => Object.assign(new Task(), t)),
      );

      await service.move(
        projectId,
        'task-2',
        { columnId: 'col-1', position: 0 },
        reporterId,
      );

      // task-2 should now be first (position 0), pushing task-1 and task-3 down
      expect(taskRepository.update).toHaveBeenCalledWith('task-2', {
        position: 0,
      });
      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        position: 1,
      });
      expect(taskRepository.update).toHaveBeenCalledWith('task-3', {
        position: 2,
      });
    });

    it('moves a task across columns and re-indexes both sides', async () => {
      const task = buildTask({ id: 'task-1', columnId: 'col-1', position: 0 });
      const sourceSiblings = [
        task,
        buildTask({ id: 'task-2', columnId: 'col-1', position: 1 }),
      ];
      const targetSiblings = [
        buildTask({ id: 'task-3', columnId: 'col-2', position: 0 }),
      ];

      taskRepository.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === 'task-1') return Promise.resolve(task);
          return Promise.resolve(null);
        },
      );
      columnRepository.findOne.mockResolvedValue({ id: 'col-2', projectId });
      taskRepository.find
        .mockResolvedValueOnce(
          sourceSiblings.map((t) => Object.assign(new Task(), t)),
        )
        .mockResolvedValueOnce(
          targetSiblings.map((t) => Object.assign(new Task(), t)),
        );

      await service.move(
        projectId,
        'task-1',
        { columnId: 'col-2', position: 1 },
        reporterId,
      );

      expect(taskRepository.update).toHaveBeenCalledWith('task-2', {
        position: 0,
      });
      expect(taskRepository.update).toHaveBeenCalledWith('task-3', {
        position: 0,
      });
      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        position: 1,
        columnId: 'col-2',
        status: TaskStatus.TODO,
      });
    });
  });

  describe('task links', () => {
    it('rejects a task linking to itself', async () => {
      taskRepository.findOne.mockResolvedValue(buildTask({ id: 'task-1' }));

      await expect(
        service.addLink(projectId, 'task-1', {
          targetTaskId: 'task-1',
          linkType: TaskLinkType.RELATES_TO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects linking to a task outside the project', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(buildTask({ id: 'task-1' }))
        .mockResolvedValueOnce(null);

      await expect(
        service.addLink(projectId, 'task-1', {
          targetTaskId: 'task-2',
          linkType: TaskLinkType.BLOCKS,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate link of the same type', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(buildTask({ id: 'task-1' }))
        .mockResolvedValueOnce(buildTask({ id: 'task-2' }));
      taskLinkRepository.findOne.mockResolvedValue({ id: 'link-1' });

      await expect(
        service.addLink(projectId, 'task-1', {
          targetTaskId: 'task-2',
          linkType: TaskLinkType.BLOCKS,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a link when valid', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(buildTask({ id: 'task-1' }))
        .mockResolvedValueOnce(buildTask({ id: 'task-2' }));
      taskLinkRepository.findOne.mockResolvedValue(null);

      const link = await service.addLink(projectId, 'task-1', {
        targetTaskId: 'task-2',
        linkType: TaskLinkType.BLOCKS,
      });

      expect(link.sourceTaskId).toBe('task-1');
      expect(link.targetTaskId).toBe('task-2');
    });

    it('rejects removing a link that does not belong to the task', async () => {
      taskRepository.findOne.mockResolvedValue(buildTask({ id: 'task-1' }));
      taskLinkRepository.findOne.mockResolvedValue({
        id: 'link-1',
        sourceTaskId: 'task-9',
        targetTaskId: 'task-8',
      });

      await expect(
        service.removeLink(projectId, 'task-1', 'link-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-removes a task', async () => {
      const task = buildTask({ id: 'task-1' });
      taskRepository.findOne.mockResolvedValue(task);

      await service.remove(projectId, 'task-1', reporterId);

      expect(taskRepository.softRemove).toHaveBeenCalledWith(task);
      expect(gateway.emitTaskDeleted).toHaveBeenCalledWith(projectId, task.id);
    });

    it('throws when the task does not exist', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(projectId, 'missing', reporterId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
