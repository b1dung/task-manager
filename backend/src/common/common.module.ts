import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextInterceptor } from '@/common/context/request-context.interceptor';
import { RequestContextService } from '@/common/context/request-context.service';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProjectMember])],
  providers: [
    ProjectMemberGuard,
    RequestContextService,
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
  exports: [TypeOrmModule, ProjectMemberGuard, RequestContextService],
})
export class CommonModule {}
