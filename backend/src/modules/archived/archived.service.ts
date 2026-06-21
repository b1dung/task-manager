import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';

interface UserView {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ArchivedTaskView {
  id: string;
  taskNumber: number | null;
  title: string;
  type: string;
  status: string;
  assignee: UserView | null;
  columnId: string | null;
  columnName: string | null;
  sprintId: string | null;
  sprintName: string | null;
  archivedAt: Date | null;
  archivedBy: UserView | null;
}

export interface ArchivedProjectView {
  id: string;
  name: string;
  slug: string;
  taskCount: number;
  memberCount: number;
  owner: UserView | null;
  archivedAt: Date | null;
  archivedBy: UserView | null;
}

@Injectable()
export class ArchivedService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private toUserView(user?: User | null): UserView | null {
    return user
      ? { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }
      : null;
  }

  private async resolveUsers(
    ids: (string | null)[],
  ): Promise<Map<string, User>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const users = await this.userRepository.find({ where: { id: In(unique) } });
    return new Map(users.map((u) => [u.id, u]));
  }

  async getArchivedTasks(projectId: string): Promise<ArchivedTaskView[]> {
    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.column', 'column')
      .leftJoinAndSelect('task.sprint', 'sprint')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.archivedAt IS NOT NULL')
      .orderBy('task.archivedAt', 'DESC')
      .getMany();

    const byUsers = await this.resolveUsers(tasks.map((t) => t.archivedBy));
    return tasks.map((t) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      title: t.title,
      type: t.type,
      status: t.status,
      assignee: this.toUserView(t.assignee),
      columnId: t.columnId,
      columnName: t.column?.name ?? null,
      sprintId: t.sprintId,
      sprintName: t.sprint?.name ?? null,
      archivedAt: t.archivedAt,
      archivedBy: this.toUserView(
        t.archivedBy ? byUsers.get(t.archivedBy) : null,
      ),
    }));
  }

  async getArchivedProjects(): Promise<ArchivedProjectView[]> {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('project.archivedAt IS NOT NULL')
      .orderBy('project.archivedAt', 'DESC')
      .getMany();
    if (projects.length === 0) return [];

    const ids = projects.map((p) => p.id);
    const taskRows: { pid: string; c: number }[] =
      await this.projectRepository.manager.query(
        `SELECT project_id AS pid, COUNT(*)::int AS c
           FROM tasks
          WHERE deleted_at IS NULL AND project_id = ANY($1)
          GROUP BY project_id`,
        [ids],
      );
    const memberRows = await this.projectMemberRepository
      .createQueryBuilder('m')
      .select('m.projectId', 'pid')
      .addSelect('COUNT(*)', 'c')
      .where('m.projectId IN (:...ids)', { ids })
      .groupBy('m.projectId')
      .getRawMany<{ pid: string; c: string }>();
    const taskMap = new Map(taskRows.map((r) => [r.pid, Number(r.c)]));
    const memberMap = new Map(memberRows.map((r) => [r.pid, Number(r.c)]));
    const byUsers = await this.resolveUsers(projects.map((p) => p.archivedBy));

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      taskCount: taskMap.get(p.id) ?? 0,
      memberCount: memberMap.get(p.id) ?? 0,
      owner: this.toUserView(p.owner),
      archivedAt: p.archivedAt,
      archivedBy: this.toUserView(
        p.archivedBy ? byUsers.get(p.archivedBy) : null,
      ),
    }));
  }
}
