import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

export interface ProjectAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  uploaderId: string;
  uploader: { id: string; fullName: string; avatarUrl: string | null } | null;
  task: { id: string; title: string; taskNumber: number | null };
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async findAllForProject(projectId: string): Promise<ProjectAttachment[]> {
    const rows = await this.attachmentRepository
      .createQueryBuilder('att')
      .innerJoin('att.task', 'task')
      .leftJoin('att.uploader', 'uploader')
      .select([
        'att.id',
        'att.taskId',
        'att.fileName',
        'att.fileUrl',
        'att.fileSize',
        'att.mimeType',
        'att.createdAt',
        'att.uploaderId',
        'task.id',
        'task.title',
        'task.taskNumber',
        'uploader.id',
        'uploader.fullName',
        'uploader.avatarUrl',
      ])
      .where('task.projectId = :projectId', { projectId })
      .orderBy('att.createdAt', 'DESC')
      .getMany();

    return rows.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: Number(a.fileSize),
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      uploaderId: a.uploaderId,
      uploader: a.uploader
        ? {
            id: a.uploader.id,
            fullName: a.uploader.fullName,
            avatarUrl: a.uploader.avatarUrl,
          }
        : null,
      task: {
        id: a.task.id,
        title: a.task.title,
        taskNumber: a.task.taskNumber,
      },
    }));
  }

  async findAllForTask(
    projectId: string,
    taskId: string,
  ): Promise<Attachment[]> {
    await this.assertTaskInProject(projectId, taskId);
    return this.attachmentRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    projectId: string,
    taskId: string,
    uploaderId: string,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    try {
      await this.assertTaskInProject(projectId, taskId);
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }

    const attachment = this.attachmentRepository.create({
      taskId,
      uploaderId,
      fileName: file.originalname,
      fileUrl: `/uploads/attachments/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
    return this.attachmentRepository.save(attachment);
  }

  async getDownload(
    projectId: string,
    taskId: string,
    id: string,
  ): Promise<{ attachment: Attachment; path: string }> {
    await this.assertTaskInProject(projectId, taskId);
    const attachment = await this.findOneOrFail(taskId, id);
    return {
      attachment,
      path: join(process.cwd(), attachment.fileUrl.replace(/^\//, '')),
    };
  }

  /**
   * Resolve an attachment by its stored filename, scoped to a project. Used to
   * stream inline description images to an authenticated, member-only request.
   * The path is taken from the DB record (never from user input), and the
   * attachment must belong to a task in the given project.
   */
  async getProjectFileByName(
    projectId: string,
    filename: string,
  ): Promise<{ attachment: Attachment; path: string }> {
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
      throw new NotFoundException('Attachment not found');
    }
    const attachment = await this.attachmentRepository.findOne({
      where: { fileUrl: `/uploads/attachments/${filename}` },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.assertTaskInProject(projectId, attachment.taskId);
    return {
      attachment,
      path: join(process.cwd(), attachment.fileUrl.replace(/^\//, '')),
    };
  }

  async remove(
    projectId: string,
    taskId: string,
    id: string,
    requesterId: string,
  ): Promise<void> {
    await this.assertTaskInProject(projectId, taskId);
    const attachment = await this.findOneOrFail(taskId, id);
    if (attachment.uploaderId !== requesterId) {
      throw new ForbiddenException('You can only remove your own attachments');
    }

    await this.attachmentRepository.remove(attachment);
    await this.deleteFile(attachment.fileUrl);
  }

  private async findOneOrFail(taskId: string, id: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id, taskId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  private async assertTaskInProject(
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }
    return task;
  }

  private async deleteFile(fileUrl: string): Promise<void> {
    const filePath = join(process.cwd(), fileUrl.replace(/^\//, ''));
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
