import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { Response } from 'express';
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

  @Get('file/:filename')
  @ApiOperation({
    summary:
      'Stream an attachment file by name (member-only) — used for inline description images',
  })
  async getFile(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { attachment, path } =
      await this.attachmentsService.getProjectFileByName(projectId, filename);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(createReadStream(path));
  }
}
