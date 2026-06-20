import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityAction, ActivityEntityType } from '@shared/enums';
import { ActivityService } from '@/modules/activity/activity.service';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';

describe('ActivityService', () => {
  let service: ActivityService;

  const projectId = 'project-1';

  let activityLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getCount: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    activityLogRepository = {
      create: jest.fn((entity) => Object.assign(new ActivityLog(), entity)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: activityLogRepository,
        },
      ],
    }).compile();

    service = module.get(ActivityService);
  });

  describe('findAllForProject', () => {
    it('always filters by project and orders by creation date', async () => {
      await service.findAllForProject(projectId, {});

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'log.projectId = :projectId',
        { projectId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'log.createdAt',
        'DESC',
      );
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('applies optional filters when provided', async () => {
      await service.findAllForProject(projectId, {
        userId: 'user-1',
        action: [ActivityAction.MOVED],
        entityType: [ActivityEntityType.TASK],
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.userId = :userId',
        { userId: 'user-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.action IN (:...actions)',
        { actions: [ActivityAction.MOVED] },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.entityType IN (:...entityTypes)',
        { entityTypes: [ActivityEntityType.TASK] },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt >= :from',
        { from: '2026-01-01' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt <= :to',
        { to: '2026-01-31' },
      );
    });
  });

  describe('record', () => {
    it('creates and saves an activity log with default null fields', async () => {
      const result = await service.record({
        projectId,
        userId: 'user-1',
        action: ActivityAction.CREATED,
        entityType: ActivityEntityType.TASK,
        entityId: 'task-1',
      });

      expect(activityLogRepository.create).toHaveBeenCalledWith({
        projectId,
        userId: 'user-1',
        action: ActivityAction.CREATED,
        entityType: ActivityEntityType.TASK,
        entityId: 'task-1',
        oldValues: null,
        newValues: null,
        ipAddress: null,
      });
      expect(activityLogRepository.save).toHaveBeenCalled();
      expect(result.projectId).toBe(projectId);
    });
  });
});
