import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSprintDto } from '@/modules/sprints/dto/create-sprint.dto';
import { UpdateSprintDto } from '@/modules/sprints/dto/update-sprint.dto';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';

@Injectable()
export class SprintsService {
  constructor(
    @InjectRepository(Sprint)
    private readonly sprintRepository: Repository<Sprint>,
  ) {}

  async findAll(projectId: string): Promise<Sprint[]> {
    return this.sprintRepository.find({
      where: { projectId },
      order: { startDate: 'ASC' },
    });
  }

  async create(projectId: string, dto: CreateSprintDto): Promise<Sprint> {
    const sprint = this.sprintRepository.create({
      projectId,
      name: dto.name,
      goal: dto.goal ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });
    return this.sprintRepository.save(sprint);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateSprintDto,
  ): Promise<Sprint> {
    const sprint = await this.findOneOrFail(projectId, id);
    Object.assign(sprint, dto);
    return this.sprintRepository.save(sprint);
  }

  async remove(projectId: string, id: string): Promise<void> {
    const sprint = await this.findOneOrFail(projectId, id);
    await this.sprintRepository.remove(sprint);
  }

  private async findOneOrFail(projectId: string, id: string): Promise<Sprint> {
    const sprint = await this.sprintRepository.findOne({
      where: { id, projectId },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }
    return sprint;
  }
}
