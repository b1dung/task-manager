import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from '@/modules/export/export.service';

describe('ExportService', () => {
  let service: ExportService;
  let exportQueue: { add: jest.Mock };

  const projectId = 'project-1';
  const requesterId = 'user-1';

  beforeEach(async () => {
    exportQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getQueueToken('export'), useValue: exportQueue },
      ],
    }).compile();

    service = module.get(ExportService);
  });

  describe('enqueueTasksExcelExport', () => {
    it('queues a tasks-excel job with the project, requester, and filters', async () => {
      const filters = { status: undefined, search: 'bug' } as never;

      const result = await service.enqueueTasksExcelExport(
        projectId,
        requesterId,
        filters,
      );

      expect(exportQueue.add).toHaveBeenCalledWith('tasks-excel', {
        projectId,
        requesterId,
        filters,
      });
      expect(result).toEqual({ jobId: 'job-1' });
    });
  });

  describe('enqueueMonthlyReportPdfExport', () => {
    it('queues a monthly-report-pdf job with the project, requester, and query', async () => {
      const query = { from: '2026-06-01', to: '2026-06-30' };

      const result = await service.enqueueMonthlyReportPdfExport(
        projectId,
        requesterId,
        query,
      );

      expect(exportQueue.add).toHaveBeenCalledWith('monthly-report-pdf', {
        projectId,
        requesterId,
        query,
      });
      expect(result).toEqual({ jobId: 'job-1' });
    });
  });
});
