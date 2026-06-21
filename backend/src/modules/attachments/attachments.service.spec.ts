import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
  open: jest.fn().mockResolvedValue({
    read: jest.fn((buffer: Buffer) => {
      Buffer.from('%PDF-1.7').copy(buffer);
      return { bytesRead: 8, buffer };
    }),
    close: jest.fn(),
  }),
}));

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const projectId = 'project-1';
  const taskId = 'task-1';
  const uploaderId = 'uploader-1';

  let attachmentRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let taskRepository: { findOne: jest.Mock };

  const buildAttachment = (overrides: Partial<Attachment> = {}): Attachment =>
    Object.assign(new Attachment(), {
      id: 'attachment-1',
      taskId,
      uploaderId,
      fileName: 'report.pdf',
      fileUrl: '/uploads/attachments/report.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date(),
      ...overrides,
    });

  const buildFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'report.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      destination: './uploads/attachments',
      filename: 'generated-name.pdf',
      path: './uploads/attachments/generated-name.pdf',
      size: 1024,
      buffer: Buffer.from(''),
      stream: undefined as never,
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();

    attachmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity) => Object.assign(new Attachment(), entity)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    taskRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: attachmentRepository,
        },
        { provide: getRepositoryToken(Task), useValue: taskRepository },
      ],
    }).compile();

    service = module.get(AttachmentsService);
  });

  describe('findAllForTask', () => {
    it('throws when the task does not belong to the project', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findAllForTask(projectId, taskId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns attachments ordered by creation date', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      const attachments = [buildAttachment()];
      attachmentRepository.find.mockResolvedValue(attachments);

      const result = await service.findAllForTask(projectId, taskId);

      expect(attachmentRepository.find).toHaveBeenCalledWith({
        where: { taskId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(attachments);
    });
  });

  describe('create', () => {
    it('saves file metadata derived from the uploaded file', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });

      const result = await service.create(
        projectId,
        taskId,
        uploaderId,
        buildFile(),
      );

      expect(attachmentRepository.create).toHaveBeenCalledWith({
        taskId,
        uploaderId,
        fileName: 'report.pdf',
        fileUrl: '/uploads/attachments/generated-name.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      });
      expect(result.fileUrl).toBe('/uploads/attachments/generated-name.pdf');
    });
  });

  describe('remove', () => {
    it('rejects removing an attachment uploaded by someone else', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      attachmentRepository.findOne.mockResolvedValue(
        buildAttachment({ uploaderId: 'someone-else' }),
      );

      await expect(
        service.remove(projectId, taskId, 'attachment-1', uploaderId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(attachmentRepository.remove).not.toHaveBeenCalled();
    });

    it('throws when the attachment does not exist on the task', async () => {
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(projectId, taskId, 'missing', uploaderId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes the database row and deletes the file for the uploader', async () => {
      const attachment = buildAttachment();
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      attachmentRepository.findOne.mockResolvedValue(attachment);
      (unlink as jest.Mock).mockResolvedValue(undefined);

      await service.remove(projectId, taskId, 'attachment-1', uploaderId);

      expect(attachmentRepository.remove).toHaveBeenCalledWith(attachment);
      expect(unlink).toHaveBeenCalled();
    });

    it('swallows ENOENT errors when the underlying file is already gone', async () => {
      const attachment = buildAttachment();
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      attachmentRepository.findOne.mockResolvedValue(attachment);
      const enoent = Object.assign(new Error('not found'), { code: 'ENOENT' });
      (unlink as jest.Mock).mockRejectedValue(enoent);

      await expect(
        service.remove(projectId, taskId, 'attachment-1', uploaderId),
      ).resolves.toBeUndefined();
    });

    it('rethrows non-ENOENT errors from file deletion', async () => {
      const attachment = buildAttachment();
      taskRepository.findOne.mockResolvedValue({ id: taskId, projectId });
      attachmentRepository.findOne.mockResolvedValue(attachment);
      const eperm = Object.assign(new Error('permission denied'), {
        code: 'EPERM',
      });
      (unlink as jest.Mock).mockRejectedValue(eperm);

      await expect(
        service.remove(projectId, taskId, 'attachment-1', uploaderId),
      ).rejects.toThrow('permission denied');
    });
  });
});
