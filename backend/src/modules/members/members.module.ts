import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { MembersController } from '@/modules/members/members.controller';
import { MembersService } from '@/modules/members/members.service';
import { RolesModule } from '@/modules/roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectMember]),
    CommonModule,
    RolesModule,
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
