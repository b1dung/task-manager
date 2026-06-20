import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '@/modules/tasks/entities/task.entity';
import { MyTasksController } from '@/modules/my-tasks/my-tasks.controller';
import { MyTasksService } from '@/modules/my-tasks/my-tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  controllers: [MyTasksController],
  providers: [MyTasksService],
})
export class MyTasksModule {}
