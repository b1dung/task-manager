import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
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
import { createReadStream } from 'fs';
import { Response } from 'express';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
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
  @RequirePermissions('create_task')
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
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed =
          /^(image\/(png|jpeg|gif|webp)|application\/(pdf|zip|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|text\/(plain|csv))$/;
        cb(
          allowed.test(file.mimetype)
            ? null
            : new BadRequestException('Unsupported file type'),
          allowed.test(file.mimetype),
        );
      },
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

  @Get(':id/download')
  async download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.attachmentsService.getDownload(
      projectId,
      taskId,
      id,
    );
    response.set({
      'Content-Type': file.attachment.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.attachment.fileName)}`,
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(file.path));
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
