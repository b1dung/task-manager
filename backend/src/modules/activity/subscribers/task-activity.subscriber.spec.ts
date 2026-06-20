import { ActivityAction, ActivityEntityType, TaskStatus } from '@shared/enums';
import { RequestContextService } from '@/common/context/request-context.service';
import { TaskActivitySubscriber } from '@/modules/activity/subscribers/task-activity.subscriber';
import { Task } from '@/modules/tasks/entities/task.entity';

describe('TaskActivitySubscriber', () => {
  const projectId = 'project-1';
  const userId = 'user-1';

  let dataSource: { subscribers: unknown[] };
  let requestContext: { userId: string | null; ipAddress: string | null };
  let activityLogRepository: { create: jest.Mock; save: jest.Mock };
  let manager: { getRepository: jest.Mock };
  let subscriber: TaskActivitySubscriber;

  const buildTask = (overrides: Partial<Task> = {}): Task =>
    Object.assign(new Task(), {
      id: 'task-1',
      projectId,
      title: 'Build feature',
      status: TaskStatus.TODO,
      columnId: 'column-1',
      assigneeId: null,
      ...overrides,
    });

  beforeEach(() => {
    dataSource = { subscribers: [] };
    requestContext = { userId, ipAddress: '127.0.0.1' };
    activityLogRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      getRepository: jest.fn().mockReturnValue(activityLogRepository),
    };

    subscriber = new TaskActivitySubscriber(
      dataSource as never,
      requestContext as RequestContextService,
    );
  });

  it('registers itself on the data source subscribers list', () => {
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('listens to the Task entity', () => {
    expect(subscriber.listenTo()).toBe(Task);
  });

  describe('afterInsert', () => {
    it('records a CREATED activity', async () => {
      const task = buildTask();

      await subscriber.afterInsert({ entity: task, manager } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          userId,
          action: ActivityAction.CREATED,
          entityType: ActivityEntityType.TASK,
          entityId: task.id,
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('does nothing when there is no authenticated user in context', async () => {
      requestContext.userId = null;
      const task = buildTask();

      await subscriber.afterInsert({ entity: task, manager } as never);

      expect(activityLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('afterUpdate', () => {
    it('infers MOVED when columnId changes, even alongside other field changes', async () => {
      const task = buildTask({ columnId: 'column-2', assigneeId: 'user-2' });
      const before = buildTask({ columnId: 'column-1', assigneeId: null });

      await subscriber.afterUpdate({
        entity: task,
        databaseEntity: before,
        manager,
      } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityAction.MOVED,
          oldValues: expect.objectContaining({ columnId: 'column-1' }),
          newValues: expect.objectContaining({ columnId: 'column-2' }),
        }),
      );
    });

    it('infers ASSIGNED when only the assignee changes', async () => {
      const task = buildTask({ assigneeId: 'user-2' });
      const before = buildTask({ assigneeId: null });

      await subscriber.afterUpdate({
        entity: task,
        databaseEntity: before,
        manager,
      } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: ActivityAction.ASSIGNED }),
      );
    });

    it('infers STATUS_CHANGED when only the status changes', async () => {
      const task = buildTask({ status: TaskStatus.IN_PROGRESS });
      const before = buildTask({ status: TaskStatus.TODO });

      await subscriber.afterUpdate({
        entity: task,
        databaseEntity: before,
        manager,
      } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: ActivityAction.STATUS_CHANGED }),
      );
    });

    it('falls back to UPDATED for other tracked field changes', async () => {
      const task = buildTask({ title: 'New title' });
      const before = buildTask({ title: 'Old title' });

      await subscriber.afterUpdate({
        entity: task,
        databaseEntity: before,
        manager,
      } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: ActivityAction.UPDATED }),
      );
    });

    it('skips logging when no tracked fields changed', async () => {
      const task = buildTask();
      const before = buildTask();

      await subscriber.afterUpdate({
        entity: task,
        databaseEntity: before,
        manager,
      } as never);

      expect(activityLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('afterSoftRemove', () => {
    it('records a DELETED activity', async () => {
      const task = buildTask();

      await subscriber.afterSoftRemove({ entity: task, manager } as never);

      expect(activityLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityAction.DELETED,
          oldValues: { title: task.title },
        }),
      );
    });
  });
});
