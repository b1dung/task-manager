import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { QueryReportsDto } from '@/modules/reports/dto/query-reports.dto';
import { QueryTasksDto } from '@/modules/tasks/dto/query-tasks.dto';

export interface TasksExcelExportJob {
  projectId: string;
  requesterId: string;
  filters: QueryTasksDto;
}

export interface MonthlyReportPdfExportJob {
  projectId: string;
  requesterId: string;
  query: QueryReportsDto;
}

export interface QueuedExport {
  jobId: string;
}

@Injectable()
export class ExportService {
  constructor(@InjectQueue('export') private readonly exportQueue: Queue) {}

  async enqueueTasksExcelExport(
    projectId: string,
    requesterId: string,
    filters: QueryTasksDto,
  ): Promise<QueuedExport> {
    const job = await this.exportQueue.add('tasks-excel', {
      projectId,
      requesterId,
      filters,
    } satisfies TasksExcelExportJob);
    return { jobId: String(job.id) };
  }

  async enqueueMonthlyReportPdfExport(
    projectId: string,
    requesterId: string,
    query: QueryReportsDto,
  ): Promise<QueuedExport> {
    const job = await this.exportQueue.add('monthly-report-pdf', {
      projectId,
      requesterId,
      query,
    } satisfies MonthlyReportPdfExportJob);
    return { jobId: String(job.id) };
  }
}
