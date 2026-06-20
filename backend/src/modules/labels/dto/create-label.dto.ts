import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateLabelDto {
  @ApiProperty({ example: 'bug' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '#ef4444' })
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'color must be a 6-digit hex value, e.g. #ef4444',
  })
  color!: string;
}
