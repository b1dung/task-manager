import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
// pdfkit ships a CommonJS `export =` with no esModuleInterop in this project's tsconfig,
// so `import = require()` is the only way to get the constructor with correct typings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');
import { Job } from 'bull';
import { NotificationType } from '@shared/enums';
import {
  CompletionRateSlice,
  MonthlyKpi,
  ReportsService,
} from '@/modules/reports/reports.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TasksService } from '@/modules/tasks/tasks.service';
import {
  MonthlyReportPdfExportJob,
  TasksExcelExportJob,
} from '@/modules/export/export.service';

export const EXPORT_DIR = join(process.cwd(), 'uploads', 'exports');
export const EXPORT_PUBLIC_PATH = '/uploads/exports';

export interface GeneratedExport {
  fileName: string;
  fileUrl: string;
}

@Processor('export')
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly reportsService: ReportsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('tasks-excel')
  async handleTasksExcelExport(
    job: Job<TasksExcelExportJob>,
  ): Promise<GeneratedExport> {
    const { projectId, requesterId, filters } = job.data;
    const { data: tasks } = await this.tasksService.findAll(projectId, {
      ...filters,
      limit: 10000,
    });

    const fileName = `tasks-${projectId}-${Date.now()}.xlsx`;
    await this.writeTasksWorkbook(tasks, fileName);

    return this.notifyExportReady(
      requesterId,
      fileName,
      'Your task list export is ready to download',
    );
  }

  @Process('monthly-report-pdf')
  async handleMonthlyReportPdfExport(
    job: Job<MonthlyReportPdfExportJob>,
  ): Promise<GeneratedExport> {
    const { projectId, requesterId, query } = job.data;
    const [kpi, completionRate] = await Promise.all([
      this.reportsService.getMonthlyKpi(projectId, query),
      this.reportsService.getCompletionRate(projectId, query),
    ]);

    const fileName = `monthly-report-${projectId}-${Date.now()}.pdf`;
    await this.writeMonthlyReportPdf(projectId, kpi, completionRate, fileName);

    return this.notifyExportReady(
      requesterId,
      fileName,
      'Your monthly report export is ready to download',
    );
  }

  private async writeTasksWorkbook(
    tasks: Task[],
    fileName: string,
  ): Promise<void> {
    await mkdir(EXPORT_DIR, { recursive: true });

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Tasks');
    sheet.columns = [
      { header: 'Title', key: 'title', width: 42 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Assignee', key: 'assignee', width: 26 },
      { header: 'Reporter', key: 'reporter', width: 26 },
      { header: 'Due date', key: 'dueDate', width: 14 },
      { header: 'Story points', key: 'storyPoints', width: 14 },
      { header: 'Estimated hours', key: 'estimatedHours', width: 16 },
      { header: 'Logged hours', key: 'loggedHours', width: 14 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const task of tasks) {
      sheet.addRow({
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee?.fullName ?? task.assignee?.email ?? '',
        reporter: task.reporter?.fullName ?? task.reporter?.email ?? '',
        dueDate: task.dueDate ?? '',
        storyPoints: task.storyPoints ?? '',
        estimatedHours: task.estimatedHours ?? '',
        loggedHours: task.loggedHours ?? '',
      });
    }

    await workbook.xlsx.writeFile(join(EXPORT_DIR, fileName));
  }

  private async writeMonthlyReportPdf(
    projectId: string,
    kpi: MonthlyKpi,
    completionRate: CompletionRateSlice[],
    fileName: string,
  ): Promise<void> {
    await mkdir(EXPORT_DIR, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = createWriteStream(join(EXPORT_DIR, fileName));
      doc.pipe(stream);

      doc.fontSize(20).text('Monthly Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).text(`Project: ${projectId}`);
      doc.text(`Period: ${kpi.from} – ${kpi.to}`);
      doc.moveDown();

      doc.fontSize(14).text('KPI summary', { underline: true });
      doc.fontSize(11);
      doc.text(`Target tasks: ${kpi.target}`);
      doc.text(`Completed tasks: ${kpi.actual}`);
      doc.text(`Completion rate: ${kpi.completionRate}%`);
      doc.moveDown();

      doc.fontSize(14).text('Completion by status', { underline: true });
      doc.fontSize(11);
      for (const slice of completionRate) {
        doc.text(`${slice.status}: ${slice.count}`);
      }

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }

  private async notifyExportReady(
    recipientId: string,
    fileName: string,
    message: string,
  ): Promise<GeneratedExport> {
    const fileUrl = `${EXPORT_PUBLIC_PATH}/${fileName}`;
    await this.notificationsService.create({
      recipientId,
      type: NotificationType.EXPORT_READY,
      entityType: 'export',
      entityId: fileName,
      message: `${message}: ${fileUrl}`,
    });
    this.logger.log(`Export ready for ${recipientId}: ${fileUrl}`);
    return { fileName, fileUrl };
  }
}
