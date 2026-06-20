import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsISO8601,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'TaskBoard Demo' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Internal demo project for the TaskBoard team',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '2026-07-31T00:00:00.000Z',
    description: 'Project deadline (ISO8601). Pass null to clear.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsISO8601()
  deadline?: string | null;

  @ApiPropertyOptional({ example: { defaultAssigneeId: null } })
  @IsOptional()
  @IsObject()
  settingsJson?: Record<string, unknown>;
}
