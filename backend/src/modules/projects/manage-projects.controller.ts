import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { AddMemberDto } from '@/modules/members/dto/add-member.dto';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { MembersService } from '@/modules/members/members.service';
import { CreateProjectDto } from '@/modules/projects/dto/create-project.dto';
import { TransferOwnerDto } from '@/modules/projects/dto/transfer-owner.dto';
import { UpdateProjectDto } from '@/modules/projects/dto/update-project.dto';
import { Project } from '@/modules/projects/entities/project.entity';
import { ProjectsService } from '@/modules/projects/projects.service';

/**
 * Cross-project administration (admins & owners). Unlike the member-scoped
 * project routes, these are gated purely by permission and operate on ANY
 * project — no project membership required.
 */
@ApiTags('manage-projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('manage/projects')
export class ManageProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly membersService: MembersService,
  ) {}

  @Get()
  @RequirePermissions('delete_project')
  @ApiOperation({
    summary: 'List every project with task/member counts (admin/owner view)',
  })
  async findAll(): Promise<{ success: true; data: Project[] }> {
    const data = await this.projectsService.findAllForManagement();
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('create_project')
  @ApiOperation({ summary: 'Create a project from the management view' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.create(user.sub, dto);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Update any project (name, description, deadline)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/archive')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Archive a project (hidden from lists, data kept)' })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.setArchived(id, true, user.sub);
    return { success: true, data };
  }

  @Patch(':id/unarchive')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Restore an archived project' })
  async unarchive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.setArchived(id, false);
    return { success: true, data };
  }

  @Patch(':id/transfer-owner')
  @RequirePermissions('delete_project')
  @ApiOperation({ summary: 'Transfer project ownership (admin/owner)' })
  async transferOwner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnerDto,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.transferOwner(id, dto.ownerId);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('delete_project')
  @ApiOperation({ summary: 'Soft-delete any project (admin/owner; data kept)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: { taskCount: number } }> {
    const taskCount = await this.projectsService.countTasks(id);
    await this.projectsService.remove(id);
    return { success: true, data: { taskCount } };
  }

  @Patch(':id/restore')
  @RequirePermissions('delete_project')
  @ApiOperation({ summary: 'Restore a soft-deleted project (undo delete)' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.restore(id);
    return { success: true, data };
  }

  // ── Members ──────────────────────────────────────────────────────────────
  @Get(':id/members')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'List members of any project' })
  async members(@Param('id', ParseUUIDPipe) id: string): Promise<{
    success: true;
    data: (ProjectMember & { taskCount: number })[];
  }> {
    const data = await this.membersService.findAll(id);
    return { success: true, data };
  }

  @Post(':id/members')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Add a member to any project' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ success: true; data: ProjectMember }> {
    const data = await this.membersService.add(id, dto.userId, dto.role);
    return { success: true, data };
  }

  @Delete(':id/members/:userId')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Remove a member from any project' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ success: true; data: null }> {
    await this.membersService.remove(id, userId);
    return { success: true, data: null };
  }
}
