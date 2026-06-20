import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskStatus } from '@shared/enums';
import { WorkingHour } from '@/modules/reports/entities/working-hour.entity';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';
import { ReportsService } from '@/modules/reports/reports.service';
import { Task } from '@/modules/tasks/entities/task.entity';

describe('ReportsService', () => {
  let service: ReportsService;

  const projectId = 'project-1';

  let taskRepository: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let workingHourRepository: { createQueryBuilder: jest.Mock };
  let activityLogRepository: { createQueryBuilder: jest.Mock };

  const buildTaskQueryBuilder = (overrides: Record<string, unknown> = {}) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  beforeEach(async () => {
    taskRepository = {
      createQueryBuilder: jest.fn(() => buildTaskQueryBuilder()),
      query: jest.fn().mockResolvedValue([{ count: '0' }]),
    };
    workingHourRepository = {
      createQueryBuilder: jest.fn(() => buildTaskQueryBuilder()),
    };
    activityLogRepository = {
      createQueryBuilder: jest.fn(() => buildTaskQueryBuilder()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        {
          provide: getRepositoryToken(WorkingHour),
          useValue: workingHourRepository,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: activityLogRepository,
        },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('getWeeklyReport', () => {
    it('groups completed tasks by day and scopes to the project', async () => {
      const qb = buildTaskQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2026-06-01', completed: '3' },
          { date: '2026-06-02', completed: '5' },
        ]),
      });
      taskRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getWeeklyReport(projectId, {});

      expect(qb.where).toHaveBeenCalledWith('task.projectId = :projectId', {
        projectId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.status = :status', {
        status: TaskStatus.DONE,
      });
      expect(result).toEqual([
        { date: '2026-06-01', completed: 3 },
        { date: '2026-06-02', completed: 5 },
      ]);
    });

    it('applies the assignee and sprint filters when provided', async () => {
      const qb = buildTaskQueryBuilder();
      taskRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getWeeklyReport(projectId, {
        userId: 'user-1',
        sprintId: 'sprint-1',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('task.assigneeId = :userId', {
        userId: 'user-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('task.sprintId = :sprintId', {
        sprintId: 'sprint-1',
      });
    });
  });

  describe('getProductivity', () => {
    it('returns a daily completion series', async () => {
      const qb = buildTaskQueryBuilder({
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ date: '2026-05-20', completed: '2' }]),
      });
      taskRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getProductivity(projectId, {});

      expect(result).toEqual([{ date: '2026-05-20', completed: 2 }]);
    });
  });

  describe('getMonthlyKpi', () => {
    it('computes target, actual, and completion rate', async () => {
      const totalQb = buildTaskQueryBuilder({
        getCount: jest.fn().mockResolvedValue(20),
      });
      const completedQb = buildTaskQueryBuilder({
        getCount: jest.fn().mockResolvedValue(15),
      });
      taskRepository.createQueryBuilder
        .mockReturnValueOnce(totalQb)
        .mockReturnValueOnce(completedQb);

      const result = await service.getMonthlyKpi(projectId, {});

      expect(result.target).toBe(20);
      expect(result.actual).toBe(15);
      expect(result.completionRate).toBe(75);
    });

    it('returns a zero completion rate when there are no tasks in range', async () => {
      const totalQb = buildTaskQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
      });
      const completedQb = buildTaskQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
      });
      taskRepository.createQueryBuilder
        .mockReturnValueOnce(totalQb)
        .mockReturnValueOnce(completedQb);

      const result = await service.getMonthlyKpi(projectId, {});

      expect(result.completionRate).toBe(0);
    });
  });

  describe('getCompletionRate', () => {
    it('groups task counts by status', async () => {
      const qb = buildTaskQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { status: TaskStatus.TODO, count: '4' },
          { status: TaskStatus.DONE, count: '9' },
        ]),
      });
      taskRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getCompletionRate(projectId, {});

      expect(qb.groupBy).toHaveBeenCalledWith('task.status');
      expect(result).toEqual([
        { status: TaskStatus.TODO, count: 4 },
        { status: TaskStatus.DONE, count: 9 },
      ]);
    });
  });

  describe('getWorkingHours', () => {
    it('merges estimated and logged hours per user', async () => {
      const estimatedQb = buildTaskQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', estimatedHours: '40' },
          { userId: 'user-2', estimatedHours: '10' },
        ]),
      });
      const loggedQb = buildTaskQueryBuilder({
        getRawMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', loggedHours: '32' },
          { userId: 'user-3', loggedHours: '5' },
        ]),
      });
      taskRepository.createQueryBuilder.mockReturnValue(estimatedQb);
      workingHourRepository.createQueryBuilder.mockReturnValue(loggedQb);

      const result = await service.getWorkingHours(projectId, {});

      expect(result).toEqual(
        expect.arrayContaining([
          { userId: 'user-1', estimatedHours: 40, loggedHours: 32 },
          { userId: 'user-2', estimatedHours: 10, loggedHours: 0 },
          { userId: 'user-3', estimatedHours: 0, loggedHours: 5 },
        ]),
      );
      expect(result).toHaveLength(3);
    });
  });
});
