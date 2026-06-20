import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsUUID } from 'class-validator';

export class ReorderColumnsDto {
  @ApiProperty({
    type: [String],
    description:
      'Column ids in the desired display order (must include every column in the project)',
  })
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  columnIds!: string[];
}
