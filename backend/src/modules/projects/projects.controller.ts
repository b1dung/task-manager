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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { CreateProjectDto } from '@/modules/projects/dto/create-project.dto';
import { UpdateProjectDto } from '@/modules/projects/dto/update-project.dto';
import { Project } from '@/modules/projects/entities/project.entity';
import { ProjectsService } from '@/modules/projects/projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequirePermissions('create_project')
  @ApiOperation({
    summary:
      'Create a project (requires create_project; creates default columns and adds the creator as admin member)',
  })
  @ApiResponse({ status: 201, description: 'Project created' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProjectDto,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.create(user.sub, dto);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List projects the current user is a member of' })
  async findAll(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: Project[] }> {
    const data = await this.projectsService.findAllForUser(user.sub);
    return { success: true, data };
  }

  @UseGuards(ProjectMemberGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a project by id (member access required)' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: Project }> {
    const data = await this.projectsService.findById(id);
    return { success: true, data };
  }

  @UseGuards(ProjectMemberGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (owner only)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProjectDto,
  ): Promise<{ success: true; data: Project }> {
    const project = await this.projectsService.findById(id);
    this.assertOwner(project, user.sub);
    const data = await this.projectsService.update(id, dto);
    return { success: true, data };
  }

  @UseGuards(ProjectMemberGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project (owner only)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    const project = await this.projectsService.findById(id);
    this.assertOwner(project, user.sub);
    await this.projectsService.remove(id);
    return { success: true, data: null };
  }

  private assertOwner(project: Project, userId: string): void {
    if (project.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the project owner can perform this action',
      );
    }
  }
}
