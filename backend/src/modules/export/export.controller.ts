import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { ExportService, QueuedExport } from '@/modules/export/export.service';
import { QueryReportsDto } from '@/modules/reports/dto/query-reports.dto';
import { QueryTasksDto } from '@/modules/tasks/dto/query-tasks.dto';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { createReadStream } from 'fs';
import { join, basename } from 'path';
import { Response } from 'express';
import { EXPORT_DIR } from '@/modules/export/export.processor';

@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
@RequirePermissions('view_reports')
@Controller('projects/:projectId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('files/:fileName')
  async download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const safeName = basename(fileName);
    if (safeName !== fileName || !safeName.includes(projectId)) {
      throw new BadRequestException('Invalid export file');
    }
    response.set({
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(join(EXPORT_DIR, safeName)));
  }

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
