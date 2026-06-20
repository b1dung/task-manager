import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLabelDto } from '@/modules/labels/dto/create-label.dto';
import { UpdateLabelDto } from '@/modules/labels/dto/update-label.dto';
import { Label } from '@/modules/labels/entities/label.entity';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
  ) {}

  async findAll(projectId: string): Promise<Label[]> {
    return this.labelRepository.find({
      where: { projectId },
      order: { name: 'ASC' },
    });
  }

  async create(projectId: string, dto: CreateLabelDto): Promise<Label> {
    const label = this.labelRepository.create({
      projectId,
      name: dto.name,
      color: dto.color,
    });
    return this.labelRepository.save(label);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateLabelDto,
  ): Promise<Label> {
    const label = await this.findOneOrFail(projectId, id);
    Object.assign(label, dto);
    return this.labelRepository.save(label);
  }

  async remove(projectId: string, id: string): Promise<void> {
    const label = await this.findOneOrFail(projectId, id);
    await this.labelRepository.remove(label);
  }

  private async findOneOrFail(projectId: string, id: string): Promise<Label> {
    const label = await this.labelRepository.findOne({
      where: { id, projectId },
    });
    if (!label) {
      throw new NotFoundException('Label not found');
    }
    return label;
  }
}
