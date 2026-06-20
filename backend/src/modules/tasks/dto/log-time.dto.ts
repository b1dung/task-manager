import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class LogTimeDto {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  hours!: number;

  @ApiPropertyOptional({ example: '2026-06-07' })
  @IsOptional()
  @IsDateString()
  loggedDate?: string;

  @ApiPropertyOptional({ example: 'Fixed login bug' })
  @IsOptional()
  @IsString()
  description?: string;
}
