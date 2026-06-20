import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@shared/enums';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'jane@taskboard.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.MEMBER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
