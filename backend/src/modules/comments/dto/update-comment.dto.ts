import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    example: 'Looks good, just fix the typo on line 3 (updated).',
  })
  @IsString()
  content!: string;
}
