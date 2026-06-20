import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ActivityAction, ActivityEntityType } from '@shared/enums';

function toArray<T>(value: unknown): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length ? (parts as T[]) : undefined;
  }
  return [value as T];
}

export class QueryActivityDto {
  @ApiPropertyOptional({ description: 'Filter by the user who performed the action' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated action types',
    enum: ActivityAction,
  })
  @IsOptional()
  @Transform(({ value }) => toArray<ActivityAction>(value))
  @IsEnum(ActivityAction, { each: true })
  action?: ActivityAction[];

  @ApiPropertyOptional({
    description: 'Comma-separated entity types',
    enum: ActivityEntityType,
  })
  @IsOptional()
  @Transform(({ value }) => toArray<ActivityEntityType>(value))
  @IsEnum(ActivityEntityType, { each: true })
  entityType?: ActivityEntityType[];

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
