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

  async findAllForUser(userId: string): Promise<Project[]> {
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
      .orderBy('project.createdAt', 'DESC')
      .getMany();
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

  async remove(id: string): Promise<void> {
    const project = await this.findById(id);
    await this.projectRepository.remove(project);
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
