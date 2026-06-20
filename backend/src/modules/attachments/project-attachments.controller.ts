import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import {
  AttachmentsService,
  ProjectAttachment,
} from '@/modules/attachments/attachments.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/attachments')
export class ProjectAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all attachments across a project' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ success: true; data: ProjectAttachment[] }> {
    const data = await this.attachmentsService.findAllForProject(projectId);
    return { success: true, data };
  }
}
