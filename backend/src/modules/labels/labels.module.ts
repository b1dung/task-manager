import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { Label } from '@/modules/labels/entities/label.entity';
import { LabelsController } from '@/modules/labels/labels.controller';
import { LabelsService } from '@/modules/labels/labels.service';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([Label]), CommonModule, RolesModule],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
