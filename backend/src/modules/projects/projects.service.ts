import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@shared/enums';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { CreateProjectDto } from '@/modules/projects/dto/create-project.dto';
import { UpdateProjectDto } from '@/modules/projects/dto/update-project.dto';
import { Project } from '@/modules/projects/entities/project.entity';

const DEFAULT_COLUMNS = ['Todo', 'In Progress', 'In Review', 'Done'];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(BoardColumn)
    private readonly columnRepository: Repository<BoardColumn>,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    const slug = dto.slug ? dto.slug : await this.generateUniqueSlug(dto.name);

    const existing = await this.projectRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('A project with this slug already exists');
    }

    const project = await this.projectRepository.save(
      this.projectRepository.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        ownerId,
        settingsJson: null,
      }),
    );

    await this.projectMemberRepository.save(
      this.projectMemberRepository.create({
        projectId: project.id,
        userId: ownerId,
        role: UserRole.ADMIN,
      }),
    );

    await this.columnRepository.save(
      DEFAULT_COLUMNS.map((name, position) =>
        this.columnRepository.create({ projectId: project.id, name, position }),
      ),
    );

    return this.findById(project.id);
  }

  async findAllForUser(
    userId: string,
    canViewAll = false,
  ): Promise<Project[]> {
    // Super users (view_all_projects) see every project, even ones they were
    // never added to as a member. Archived/soft-deleted projects stay hidden.
    if (canViewAll) {
      return this.projectRepository
        .createQueryBuilder('project')
        .leftJoinAndSelect('project.owner', 'owner')
        .where('project.archivedAt IS NULL')
        .orderBy('project.createdAt', 'DESC')
        .getMany();
    }

    const memberships = await this.projectMemberRepository.find({
      where: { userId },
    });
    const projectIds = memberships.map((membership) => membership.projectId);
    if (projectIds.length === 0) {
      return [];
    }
    return this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .where('project.id IN (:...projectIds)', { projectIds })
      .andWhere('project.archivedAt IS NULL')
      .orderBy('project.createdAt', 'DESC')
      .getMany();
  }

  /** Management view (admins/owners): every non-deleted project — including
   * archived ones — enriched with task & member counts. */
  async findAllForManagement(): Promise<Project[]> {
    const projects = await this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner')
      .orderBy('project.archivedAt', 'ASC', 'NULLS FIRST')
      .addOrderBy('project.createdAt', 'DESC')
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
    for (const p of projects) {
      p.taskCount = taskMap.get(p.id) ?? 0;
      p.memberCount = memberMap.get(p.id) ?? 0;
    }
    return projects;
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findById(id);
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  /** Soft delete — keeps all project data, just hides it. */
  async remove(id: string): Promise<void> {
    const project = await this.findById(id);
    await this.projectRepository.softRemove(project);
  }

  /** Recover a soft-deleted project (undo delete). */
  async restore(id: string): Promise<Project> {
    const existing = await this.projectRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }
    await this.projectRepository.restore(id);
    return this.findById(id);
  }

  async setArchived(
    id: string,
    archived: boolean,
    actorId?: string,
  ): Promise<Project> {
    const project = await this.findById(id);
    project.archivedAt = archived ? new Date() : null;
    project.archivedBy = archived ? (actorId ?? null) : null;
    return this.projectRepository.save(project);
  }

  async countTasks(id: string): Promise<number> {
    return this.projectRepository.manager.query(
      `SELECT COUNT(*)::int AS c FROM tasks WHERE deleted_at IS NULL AND project_id = $1`,
      [id],
    ).then((rows: { c: number }[]) => rows[0]?.c ?? 0);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project';

    let candidate = base;
    let suffix = 1;
    while (
      await this.projectRepository.findOne({ where: { slug: candidate } })
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
