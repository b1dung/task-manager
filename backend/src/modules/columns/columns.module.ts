import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { ColumnsController } from '@/modules/columns/columns.controller';
import { ColumnsService } from '@/modules/columns/columns.service';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [TypeOrmModule.forFeature([BoardColumn]), CommonModule, RolesModule],
  controllers: [ColumnsController],
  providers: [ColumnsService],
  exports: [ColumnsService],
})
export class ColumnsModule {}
