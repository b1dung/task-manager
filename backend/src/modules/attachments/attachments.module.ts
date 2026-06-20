import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import { ProjectAttachmentsController } from '@/modules/attachments/project-attachments.controller';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { Attachment } from '@/modules/attachments/entities/attachment.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment, Task]),
    CommonModule,
    RolesModule,
  ],
  controllers: [AttachmentsController, ProjectAttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
