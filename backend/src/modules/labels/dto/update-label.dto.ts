import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateLabelDto {
  @ApiPropertyOptional({ example: 'bug' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'color must be a 6-digit hex value, e.g. #ef4444',
  })
  color?: string;
}
