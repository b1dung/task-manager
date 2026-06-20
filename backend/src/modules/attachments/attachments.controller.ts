import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List attachments on a task' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<{ success: true; data: Attachment[] }> {
    const data = await this.attachmentsService.findAllForTask(
      projectId,
      taskId,
    );
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Upload an attachment to a task' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/attachments',
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 250 * 1024 * 1024 },
    }),
  )
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: Attachment }> {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    const data = await this.attachmentsService.create(
      projectId,
      taskId,
      user.sub,
      file,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove your own attachment' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.attachmentsService.remove(projectId, taskId, id, user.sub);
    return { success: true, data: null };
  }
}
