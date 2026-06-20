import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { ExportService, QueuedExport } from '@/modules/export/export.service';
import { QueryReportsDto } from '@/modules/reports/dto/query-reports.dto';
import { QueryTasksDto } from '@/modules/tasks/dto/query-tasks.dto';

@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('tasks/excel')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Queue an Excel export of the (optionally filtered) task list; a notification with the download link is sent when ready',
  })
  async exportTasksExcel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTasksDto,
  ): Promise<{ success: true; data: QueuedExport }> {
    const data = await this.exportService.enqueueTasksExcelExport(
      projectId,
      user.sub,
      query,
    );
    return { success: true, data };
  }

  @Post('reports/monthly/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Queue a PDF export of the monthly report; a notification with the download link is sent when ready',
  })
  async exportMonthlyReportPdf(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: QueuedExport }> {
    const data = await this.exportService.enqueueMonthlyReportPdfExport(
      projectId,
      user.sub,
      query,
    );
    return { success: true, data };
  }
}
