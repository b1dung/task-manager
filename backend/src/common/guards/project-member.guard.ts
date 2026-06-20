import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';

export interface RequestWithProjectMember extends Request {
  user: JwtPayload;
  projectMember: ProjectMember;
}

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithProjectMember>();
    const rawProjectId = request.params.projectId ?? request.params.id;
    const projectId = Array.isArray(rawProjectId)
      ? rawProjectId[0]
      : rawProjectId;
    const userId = request.user?.sub;

    if (!projectId || !userId) {
      throw new ForbiddenException('Project membership is required');
    }

    const member = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this project');
    }

    request.projectMember = member;
    return true;
  }
}
