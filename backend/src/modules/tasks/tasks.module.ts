import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { Label } from '@/modules/labels/entities/label.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { TaskLink } from '@/modules/tasks/entities/task-link.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TasksController } from '@/modules/tasks/tasks.controller';
import { TasksService } from '@/modules/tasks/tasks.service';
import { WebsocketModule } from '@/modules/websocket/websocket.module';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskLink,
      BoardColumn,
      Sprint,
      Label,
      ProjectMember,
    ]),
    CommonModule,
    WebsocketModule,
    NotificationsModule,
    RolesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
