import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskPriority, TaskType } from '@shared/enums';

function toArray<T>(value: unknown): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? (parts as T[]) : undefined;
  }
  return [value as T];
}

export class QueryReportsDto {
  @ApiPropertyOptional({ description: 'Filter by assignee/working-hours user' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by sprint' })
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated priorities' })
  @IsOptional()
  @Transform(({ value }) => toArray<TaskPriority>(value))
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @ApiPropertyOptional({ description: 'Comma-separated task types' })
  @IsOptional()
  @Transform(({ value }) => toArray<TaskType>(value))
  @IsEnum(TaskType, { each: true })
  type?: TaskType[];

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
