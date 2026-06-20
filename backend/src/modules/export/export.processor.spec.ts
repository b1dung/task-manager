import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import {
  NotificationType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@shared/enums';
import { ExportProcessor } from '@/modules/export/export.processor';
import {
  MonthlyReportPdfExportJob,
  TasksExcelExportJob,
} from '@/modules/export/export.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { ReportsService } from '@/modules/reports/reports.service';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TasksService } from '@/modules/tasks/tasks.service';

const addRow = jest.fn();
const getRow = jest.fn(() => ({ font: undefined }) as { font?: unknown });
const writeFile = jest.fn().mockResolvedValue(undefined);
const worksheet: { columns: unknown; addRow: jest.Mock; getRow: jest.Mock } = {
  columns: undefined,
  addRow,
  getRow,
};
const addWorksheet = jest.fn(() => worksheet);

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet,
    xlsx: { writeFile },
  })),
}));

const pdfDoc = {
  pipe: jest.fn(),
  fontSize: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  end: jest.fn(),
};

jest.mock('pdfkit', () => jest.fn().mockImplementation(() => pdfDoc));

interface FakeStream {
  on: jest.Mock<FakeStream, [string, (...args: unknown[]) => void]>;
}

const fakeStream: FakeStream = {
  on: jest.fn((event, cb) => {
    if (event === 'finish') {
      queueMicrotask(() => cb());
    }
    return fakeStream;
  }),
};

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createWriteStream: jest.fn(() => fakeStream),
}));
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

describe('ExportProcessor', () => {
  let processor: ExportProcessor;
  let tasksService: { findAll: jest.Mock };
  let reportsService: {
    getMonthlyKpi: jest.Mock;
    getCompletionRate: jest.Mock;
  };
  let notificationsService: { create: jest.Mock };

  const projectId = 'project-1';
  const requesterId = 'user-1';

  const buildTask = (overrides: Partial<Task> = {}): Task =>
    Object.assign(new Task(), {
      id: 'task-1',
      projectId,
      title: 'Implement export',
      type: TaskType.TASK,
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assignee: { fullName: 'Alice', email: 'alice@example.com' },
      reporter: { fullName: 'Bob', email: 'bob@example.com' },
      dueDate: '2026-06-10',
      storyPoints: 5,
      estimatedHours: 8,
      loggedHours: 6,
      ...overrides,
    });

  beforeEach(async () => {
    jest.clearAllMocks();

    tasksService = {
      findAll: jest.fn().mockResolvedValue({
        data: [buildTask()],
        meta: { page: 1, limit: 10000, total: 1, totalPages: 1 },
      }),
    };
    reportsService = {
      getMonthlyKpi: jest.fn().mockResolvedValue({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T00:00:00.000Z',
        target: 10,
        actual: 7,
        completionRate: 70,
      }),
      getCompletionRate: jest.fn().mockResolvedValue([
        { status: TaskStatus.DONE, count: 7 },
        { status: TaskStatus.TODO, count: 3 },
      ]),
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportProcessor,
        { provide: TasksService, useValue: tasksService },
        { provide: ReportsService, useValue: reportsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    processor = module.get(ExportProcessor);
  });

  describe('handleTasksExcelExport', () => {
    it('builds a workbook from the filtered task list and notifies the requester', async () => {
      const job = {
        data: { projectId, requesterId, filters: { q: 'export' } },
      } as unknown as Job<TasksExcelExportJob>;

      const result = await processor.handleTasksExcelExport(job);

      expect(tasksService.findAll).toHaveBeenCalledWith(projectId, {
        q: 'export',
        limit: 10000,
      });
      expect(addWorksheet).toHaveBeenCalledWith('Tasks');
      expect(addRow).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Implement export',
          assignee: 'Alice',
          reporter: 'Bob',
        }),
      );
      expect(writeFile).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: requesterId,
          type: NotificationType.EXPORT_READY,
          entityType: 'export',
        }),
      );
      expect(result.fileUrl).toMatch(
        new RegExp(
          `^/api/v1/projects/${projectId}/export/files/tasks-${projectId}-\\d+\\.xlsx$`,
        ),
      );
    });
  });

  describe('handleMonthlyReportPdfExport', () => {
    it('renders the KPI summary and completion breakdown to a PDF and notifies the requester', async () => {
      const job = {
        data: {
          projectId,
          requesterId,
          query: { from: '2026-06-01', to: '2026-06-30' },
        },
      } as unknown as Job<MonthlyReportPdfExportJob>;

      const result = await processor.handleMonthlyReportPdfExport(job);

      expect(reportsService.getMonthlyKpi).toHaveBeenCalledWith(
        projectId,
        job.data.query,
      );
      expect(reportsService.getCompletionRate).toHaveBeenCalledWith(
        projectId,
        job.data.query,
      );
      expect(pdfDoc.text).toHaveBeenCalledWith('Target tasks: 10');
      expect(pdfDoc.text).toHaveBeenCalledWith(`${TaskStatus.DONE}: 7`);
      expect(pdfDoc.end).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: requesterId,
          type: NotificationType.EXPORT_READY,
          entityType: 'export',
        }),
      );
      expect(result.fileUrl).toMatch(
        new RegExp(
          `^/api/v1/projects/${projectId}/export/files/monthly-report-${projectId}-\\d+\\.pdf$`,
        ),
      );
    });
  });
});
