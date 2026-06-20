import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { ExportController } from '@/modules/export/export.controller';
import { ExportProcessor } from '@/modules/export/export.processor';
import { ExportService } from '@/modules/export/export.service';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { TasksModule } from '@/modules/tasks/tasks.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'export' }),
    CommonModule,
    TasksModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [ExportController],
  providers: [ExportService, ExportProcessor],
  exports: [ExportService],
})
export class ExportModule {}
