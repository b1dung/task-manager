import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
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

  @ApiPropertyOptional({ example: { defaultAssigneeId: null } })
  @IsOptional()
  @IsObject()
  settingsJson?: Record<string, unknown>;
}
