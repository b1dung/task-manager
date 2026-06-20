import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PERMISSION_KEYS } from '@/modules/roles/permissions.catalog';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Reviewer' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Chỉ review và approve task' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['view_pages', 'approve_task'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: string[];
}
