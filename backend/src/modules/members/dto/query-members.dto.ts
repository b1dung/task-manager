import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { UserRole } from '@shared/enums';

export enum WorkloadFilter {
  OVERLOADED = 'overloaded', // > 5 active tasks
  NORMAL = 'normal', // 1–5 active tasks
  FREE = 'free', // 0 active tasks
}

export class QueryMembersDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: WorkloadFilter })
  @IsOptional()
  @IsEnum(WorkloadFilter)
  workload?: WorkloadFilter;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
