import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { QueryReportsDto } from '@/modules/reports/dto/query-reports.dto';
import {
  CompletionRateSlice,
  DailyCompletionPoint,
  DeveloperReport,
  MonthlyKpi,
  ProjectSummary,
  ReportsService,
  WorkingHoursPoint,
} from '@/modules/reports/reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
@RequirePermissions('view_reports')
@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated dashboard summary for a project' })
  async summary(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ success: true; data: ProjectSummary }> {
    const data = await this.reportsService.getSummary(projectId);
    return { success: true, data };
  }

  @Get('developer-report')
  @ApiOperation({
    summary: 'Per-developer performance report for a date range',
  })
  async developerReport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: DeveloperReport }> {
    const data = await this.reportsService.getDeveloperReport(projectId, query);
    return { success: true, data };
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Tasks completed per day over the last week' })
  async weekly(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: DailyCompletionPoint[] }> {
    const data = await this.reportsService.getWeeklyReport(projectId, query);
    return { success: true, data };
  }

  @Get('monthly-kpi')
  @ApiOperation({
    summary: 'Target vs actual tasks and completion rate for a date range',
  })
  async monthlyKpi(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: MonthlyKpi }> {
    const data = await this.reportsService.getMonthlyKpi(projectId, query);
    return { success: true, data };
  }

  @Get('productivity')
  @ApiOperation({ summary: 'Tasks completed per day over time' })
  async productivity(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: DailyCompletionPoint[] }> {
    const data = await this.reportsService.getProductivity(projectId, query);
    return { success: true, data };
  }

  @Get('completion-rate')
  @ApiOperation({ summary: 'Task counts grouped by status' })
  async completionRate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: CompletionRateSlice[] }> {
    const data = await this.reportsService.getCompletionRate(projectId, query);
    return { success: true, data };
  }

  @Get('working-hours')
  @ApiOperation({ summary: 'Estimated vs logged hours per user' })
  async workingHours(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryReportsDto,
  ): Promise<{ success: true; data: WorkingHoursPoint[] }> {
    const data = await this.reportsService.getWorkingHours(projectId, query);
    return { success: true, data };
  }
}
