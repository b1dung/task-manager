import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { ActivityController } from '@/modules/activity/activity.controller';
import { ActivityService } from '@/modules/activity/activity.service';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';
import { TaskActivitySubscriber } from '@/modules/activity/subscribers/task-activity.subscriber';
import { Task } from '@/modules/tasks/entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, Task]), CommonModule],
  controllers: [ActivityController],
  providers: [ActivityService, TaskActivitySubscriber],
  exports: [ActivityService],
})
export class ActivityModule {}
