import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { TaskLinkType } from '@shared/enums';

export class CreateTaskLinkDto {
  @ApiProperty({
    description: 'ID of the task being linked to (must belong to this project)',
  })
  @IsUUID()
  targetTaskId!: string;

  @ApiProperty({ enum: TaskLinkType })
  @IsEnum(TaskLinkType)
  linkType!: TaskLinkType;
}
