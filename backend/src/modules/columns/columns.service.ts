import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { CreateColumnDto } from '@/modules/columns/dto/create-column.dto';
import { UpdateColumnDto } from '@/modules/columns/dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    @InjectRepository(BoardColumn)
    private readonly columnRepository: Repository<BoardColumn>,
  ) {}

  async findAll(projectId: string): Promise<BoardColumn[]> {
    return this.columnRepository.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
  }

  async create(projectId: string, dto: CreateColumnDto): Promise<BoardColumn> {
    const last = await this.columnRepository.findOne({
      where: { projectId },
      order: { position: 'DESC' },
    });
    const column = this.columnRepository.create({
      projectId,
      name: dto.name,
      color: dto.color ?? null,
      wipLimit: dto.wipLimit ?? null,
      position: last ? last.position + 1 : 0,
    });
    return this.columnRepository.save(column);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateColumnDto,
  ): Promise<BoardColumn> {
    const column = await this.findOneOrFail(projectId, id);
    Object.assign(column, dto);
    return this.columnRepository.save(column);
  }

  async remove(projectId: string, id: string): Promise<void> {
    const column = await this.findOneOrFail(projectId, id);
    await this.columnRepository.remove(column);
  }

  async reorder(
    projectId: string,
    columnIds: string[],
  ): Promise<BoardColumn[]> {
    const columns = await this.findAll(projectId);
    if (
      columns.length !== columnIds.length ||
      !columns.every((column) => columnIds.includes(column.id))
    ) {
      throw new BadRequestException(
        'columnIds must include every column of the project exactly once',
      );
    }

    await Promise.all(
      columnIds.map((id, position) =>
        this.columnRepository.update({ id, projectId }, { position }),
      ),
    );

    return this.findAll(projectId);
  }

  private async findOneOrFail(
    projectId: string,
    id: string,
  ): Promise<BoardColumn> {
    const column = await this.columnRepository.findOne({
      where: { id, projectId },
    });
    if (!column) {
      throw new NotFoundException('Column not found');
    }
    return column;
  }
}
