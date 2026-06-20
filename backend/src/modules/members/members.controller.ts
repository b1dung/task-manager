import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@shared/enums';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '@/modules/auth/decorators/require-permissions.decorator';
import { UserPermissions } from '@/modules/auth/decorators/user-permissions.decorator';
import { AddMemberDto } from '@/modules/members/dto/add-member.dto';
import { QueryMembersDto } from '@/modules/members/dto/query-members.dto';
import { UpdateMemberRoleDto } from '@/modules/members/dto/update-member-role.dto';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { MembersService } from '@/modules/members/members.service';

@ApiTags('project-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({
    summary: 'List project members (filterable by role, workload, status)',
  })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryMembersDto,
  ): Promise<{
    success: true;
    data: (ProjectMember & { taskCount: number })[];
  }> {
    const data = await this.membersService.findAll(projectId, query);
    return { success: true, data };
  }

  @Post()
  @RequireAnyPermissions('manage_users', 'invite_client')
  @ApiOperation({ summary: 'Add a member to the project (admin only)' })
  async add(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
    @UserPermissions() permissions: string[],
  ): Promise<{ success: true; data: ProjectMember }> {
    if (!permissions.includes('manage_users') && dto.role !== UserRole.VIEWER) {
      throw new ForbiddenException(
        'invite_client can only add Client/Viewer members',
      );
    }
    const data = await this.membersService.add(projectId, dto.userId, dto.role);
    return { success: true, data };
  }

  @Patch(':userId')
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: "Update a member's role (admin only)" })
  async updateRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<{ success: true; data: ProjectMember }> {
    const data = await this.membersService.updateRole(
      projectId,
      userId,
      dto.role,
    );
    return { success: true, data };
  }

  @Delete(':userId')
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: 'Remove a member from the project (admin only)' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ success: true; data: null }> {
    await this.membersService.remove(projectId, userId);
    return { success: true, data: null };
  }
}
