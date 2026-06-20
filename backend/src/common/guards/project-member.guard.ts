import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { UserRole } from '@shared/enums';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { RolesService } from '@/modules/roles/roles.service';

export interface RequestWithProjectMember extends Request {
  user: JwtPayload;
  projectMember: ProjectMember;
}

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    private readonly rolesService: RolesService,
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

    if (member) {
      request.projectMember = member;
      return true;
    }

    // Super users (view_all_projects) can access any project without being a
    // member. They act as a project admin so they retain full control.
    const permissions = await this.rolesService.resolvePermissions(
      request.user,
    );
    if (permissions.includes('view_all_projects')) {
      request.projectMember = {
        projectId,
        userId,
        role: UserRole.ADMIN,
      } as ProjectMember;
      return true;
    }

    throw new ForbiddenException('You are not a member of this project');
  }
}
