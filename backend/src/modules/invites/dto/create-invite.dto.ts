import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({ example: 'jane@taskboard.dev' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Dynamic role (roles table) to assign on acceptance.',
    example: 'b1d2c3e4-...',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
