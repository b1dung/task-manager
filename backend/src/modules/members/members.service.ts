import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskStatus, UserRole } from '@shared/enums';
import { QueryMembersDto, WorkloadFilter } from '@/modules/members/dto/query-members.dto';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
  ) {}

  async findAll(
    projectId: string,
    query?: QueryMembersDto,
  ): Promise<(ProjectMember & { taskCount: number })[]> {
    const qb = this.projectMemberRepository
      .createQueryBuilder('pm')
      .leftJoinAndSelect('pm.user', 'user')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(*)', 'cnt')
            .from('tasks', 't')
            .where('t.assignee_id = pm.user_id')
            .andWhere('t.project_id = pm.project_id')
            .andWhere(`t.status IN ('${TaskStatus.TODO}','${TaskStatus.IN_PROGRESS}','${TaskStatus.IN_REVIEW}')`)
            .andWhere('t.deleted_at IS NULL'),
        'taskCount',
      )
      .where('pm.projectId = :projectId', { projectId });

    if (query?.role) {
      qb.andWhere('pm.role = :role', { role: query.role });
    }

    if (query?.status === 'active') {
      qb.andWhere('user.isActive = true');
    } else if (query?.status === 'inactive') {
      qb.andWhere('user.isActive = false');
    }

    qb.orderBy('pm.joinedAt', 'ASC');

    const rawResults = await qb.getRawAndEntities();
    const members = rawResults.entities as (ProjectMember & {
      taskCount: number;
    })[];

    rawResults.entities.forEach((member, idx) => {
      const raw = rawResults.raw[idx] as { taskCount: string };
      (members[idx] as ProjectMember & { taskCount: number }).taskCount =
        Number(raw?.taskCount ?? 0);
    });

    if (query?.workload) {
      return members.filter((m) => {
        switch (query.workload) {
          case WorkloadFilter.OVERLOADED:
            return m.taskCount > 5;
          case WorkloadFilter.NORMAL:
            return m.taskCount >= 1 && m.taskCount <= 5;
          case WorkloadFilter.FREE:
            return m.taskCount === 0;
          default:
            return true;
        }
      });
    }

    return members;
  }

  async add(
    projectId: string,
    userId: string,
    role: UserRole = UserRole.MEMBER,
  ): Promise<ProjectMember> {
    const existing = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }
    const member = await this.projectMemberRepository.save(
      this.projectMemberRepository.create({ projectId, userId, role }),
    );
    return this.findOneOrFail(projectId, member.userId);
  }

  async updateRole(
    projectId: string,
    userId: string,
    role: UserRole,
  ): Promise<ProjectMember> {
    const member = await this.findOneOrFail(projectId, userId);
    member.role = role;
    return this.projectMemberRepository.save(member);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const member = await this.findOneOrFail(projectId, userId);
    await this.projectMemberRepository.remove(member);
  }

  private async findOneOrFail(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const member = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });
    if (!member) {
      throw new NotFoundException('Project member not found');
    }
    return member;
  }
}
