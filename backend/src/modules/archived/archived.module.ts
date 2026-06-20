import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';
import { ArchivedController } from '@/modules/archived/archived.controller';
import { ArchivedService } from '@/modules/archived/archived.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Project, ProjectMember, User])],
  controllers: [ArchivedController],
  providers: [ArchivedService],
})
export class ArchivedModule {}
