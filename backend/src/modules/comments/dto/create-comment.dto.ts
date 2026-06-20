import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Looks good, just fix the typo on line 3.' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'ID of the comment being replied to' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'User IDs mentioned in the comment (must be project members)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionedUserIds?: string[];
}
