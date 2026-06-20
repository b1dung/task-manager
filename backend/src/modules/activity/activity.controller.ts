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
import { ActivityService, PaginatedActivityLogs } from '@/modules/activity/activity.service';
import { QueryActivityDto } from '@/modules/activity/dto/query-activity.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({
    summary: 'List the activity timeline for a project (with optional filters)',
  })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryActivityDto,
  ): Promise<PaginatedActivityLogs & { success: true }> {
    const result = await this.activityService.findAllForProject(projectId, query);
    return { success: true, ...result };
  }
}
