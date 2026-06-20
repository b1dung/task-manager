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
import { CurrentProjectMember } from '@/common/decorators/current-project-member.decorator';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { AddMemberDto } from '@/modules/members/dto/add-member.dto';
import { QueryMembersDto } from '@/modules/members/dto/query-members.dto';
import { UpdateMemberRoleDto } from '@/modules/members/dto/update-member-role.dto';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { MembersService } from '@/modules/members/members.service';

@ApiTags('project-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'List project members (filterable by role, workload, status)' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryMembersDto,
  ): Promise<{ success: true; data: (ProjectMember & { taskCount: number })[] }> {
    const data = await this.membersService.findAll(projectId, query);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Add a member to the project (admin only)' })
  async add(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentProjectMember() requester: ProjectMember,
    @Body() dto: AddMemberDto,
  ): Promise<{ success: true; data: ProjectMember }> {
    this.assertAdmin(requester);
    const data = await this.membersService.add(projectId, dto.userId, dto.role);
    return { success: true, data };
  }

  @Patch(':userId')
  @ApiOperation({ summary: "Update a member's role (admin only)" })
  async updateRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentProjectMember() requester: ProjectMember,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<{ success: true; data: ProjectMember }> {
    this.assertAdmin(requester);
    const data = await this.membersService.updateRole(
      projectId,
      userId,
      dto.role,
    );
    return { success: true, data };
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a member from the project (admin only)' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentProjectMember() requester: ProjectMember,
  ): Promise<{ success: true; data: null }> {
    this.assertAdmin(requester);
    await this.membersService.remove(projectId, userId);
    return { success: true, data: null };
  }

  private assertAdmin(member: ProjectMember): void {
    if (member.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only project admins can manage members');
    }
  }
}
