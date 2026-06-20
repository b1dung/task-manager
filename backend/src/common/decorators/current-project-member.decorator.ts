import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { RequestWithProjectMember } from '@/common/guards/project-member.guard';

export const CurrentProjectMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectMember => {
    const request = ctx.switchToHttp().getRequest<RequestWithProjectMember>();
    return request.projectMember;
  },
);
