import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TaskPriority, TaskType } from '@shared/enums';

export class CreateTaskDto {
  @ApiProperty({ example: 'Design the login page' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'Create wireframes and high-fidelity mockups',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'a3f1c2d4-5b6e-7f80-9a1b-2c3d4e5f6071' })
  @IsUUID()
  columnId!: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'User ID of the assignee (must be a project member)',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Sprint ID (must belong to this project)',
  })
  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @ApiPropertyOptional({ description: 'Parent task ID for subtasks' })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  storyPoints?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Label IDs to attach (must belong to this project)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];
}
