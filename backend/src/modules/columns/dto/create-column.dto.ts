import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateColumnDto {
  @ApiProperty({ example: 'In Progress' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 5, description: 'Work-in-progress limit' })
  @IsOptional()
  @IsInt()
  @Min(0)
  wipLimit?: number;
}
