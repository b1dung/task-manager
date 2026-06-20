import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { ManageProjectsController } from '@/modules/projects/manage-projects.controller';
import { ProjectsController } from '@/modules/projects/projects.controller';
import { ProjectsService } from '@/modules/projects/projects.service';
import { MembersModule } from '@/modules/members/members.module';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember, BoardColumn]),
    CommonModule,
    RolesModule,
    MembersModule,
  ],
  controllers: [ProjectsController, ManageProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
