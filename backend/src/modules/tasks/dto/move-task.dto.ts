import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({
    description: 'Target column ID (must belong to this project)',
  })
  @IsUUID()
  columnId!: string;

  @ApiProperty({
    description: 'Zero-based target position within the column',
    example: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}
