import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferOwnerDto {
  @ApiProperty({ description: 'User id of the new project owner' })
  @IsUUID()
  ownerId!: string;
}
