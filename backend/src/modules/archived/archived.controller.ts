import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { UserPermissions } from '@/modules/auth/decorators/user-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import {
  ArchivedProjectView,
  ArchivedService,
  ArchivedTaskView,
} from '@/modules/archived/archived.service';

@ApiTags('archived')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
@Controller('projects/:projectId/archived')
export class ArchivedController {
  constructor(private readonly archivedService: ArchivedService) {}

  @Get()
  @RequirePermissions('approve_task')
  @ApiOperation({
    summary:
      'List archived items (tasks always; projects only with delete_project)',
  })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UserPermissions() permissions: string[],
  ): Promise<{
    success: true;
    data: { tasks: ArchivedTaskView[]; projects: ArchivedProjectView[] };
  }> {
    const tasks = await this.archivedService.getArchivedTasks(projectId);
    const projects = permissions.includes('delete_project')
      ? await this.archivedService.getArchivedProjects()
      : [];
    return { success: true, data: { tasks, projects } };
  }
}
