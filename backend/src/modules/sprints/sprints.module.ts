import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { SprintsController } from '@/modules/sprints/sprints.controller';
import { SprintsService } from '@/modules/sprints/sprints.service';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sprint]), CommonModule, RolesModule],
  controllers: [SprintsController],
  providers: [SprintsService],
  exports: [SprintsService],
})
export class SprintsModule {}
