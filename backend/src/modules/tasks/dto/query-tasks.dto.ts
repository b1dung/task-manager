import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TaskPriority, TaskStatus, TaskType } from '@shared/enums';

/** Parse a query param that may be a single value or comma-separated list */
function toArray<T>(value: unknown): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length ? (parts as T[]) : undefined;
  }
  return [value as T];
}

export enum DueFilter {
  OVERDUE = 'overdue',
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  NO_DUE_DATE = 'no_due_date',
}

export class QueryTasksDto {
  // ── Multi-value enum filters ──────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Comma-separated statuses, e.g. todo,in_progress',
  })
  @IsOptional()
  @Transform(({ value }) => toArray<TaskStatus>(value))
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  @ApiPropertyOptional({
    description: 'Comma-separated priorities, e.g. high,urgent',
  })
  @IsOptional()
  @Transform(({ value }) => toArray<TaskPriority>(value))
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @ApiPropertyOptional({
    description: 'Comma-separated types, e.g. bug,feature',
  })
  @IsOptional()
  @Transform(({ value }) => toArray<TaskType>(value))
  @IsEnum(TaskType, { each: true })
  type?: TaskType[];

  // ── Single-value UUID filters ─────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Comma-separated assignee UUIDs' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsUUID('4', { each: true })
  assigneeId?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated sprint UUIDs' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsUUID('4', { each: true })
  sprintId?: string[];

  @ApiPropertyOptional({ description: 'Comma-separated label UUIDs' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsUUID('4', { each: true })
  labelId?: string[];

  // ── Due-date shortcut ─────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: DueFilter })
  @IsOptional()
  @IsEnum(DueFilter)
  due?: DueFilter;

  // ── Date range filters ────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  updatedTo?: string;

  // ── Hours range filters ───────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHoursMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHoursMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loggedHoursMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loggedHoursMax?: number;

  // ── Boolean filters ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'true = has attachment, false = none' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasAttachment?: boolean;

  @ApiPropertyOptional({ description: 'true = has subtask, false = none' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  hasSubtask?: boolean;

  @ApiPropertyOptional({ description: 'false = only parent tasks (no subtasks), default includes all' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  includeSubtasks?: boolean;

  // ── Full-text search ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Search task title and description' })
  @IsOptional()
  @IsString()
  q?: string;

  // ── Pagination & sorting ──────────────────────────────────────────────────

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, description: 'Max 200' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    default: 'position',
    enum: ['position', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'title'],
  })
  @IsOptional()
  @IsIn(['position', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'title'])
  sort?: string = 'position';

  @ApiPropertyOptional({ default: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'ASC';
}
