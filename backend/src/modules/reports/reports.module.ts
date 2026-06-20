import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { RolesModule } from '@/modules/roles/roles.module';
import { ReportsController } from '@/modules/reports/reports.controller';
import { ReportsService } from '@/modules/reports/reports.service';
import { WorkingHour } from '@/modules/reports/entities/working-hour.entity';
import { ActivityLog } from '@/modules/activity/entities/activity-log.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, WorkingHour, ActivityLog]),
    CommonModule,
    RolesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
