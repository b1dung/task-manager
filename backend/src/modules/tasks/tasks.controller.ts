import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { CreateTaskLinkDto } from '@/modules/tasks/dto/create-task-link.dto';
import { CreateTaskDto } from '@/modules/tasks/dto/create-task.dto';
import { LogTimeDto } from '@/modules/tasks/dto/log-time.dto';
import { MoveTaskDto } from '@/modules/tasks/dto/move-task.dto';
import { QueryTasksDto } from '@/modules/tasks/dto/query-tasks.dto';
import { UpdateTaskDto } from '@/modules/tasks/dto/update-task.dto';
import { TaskLink } from '@/modules/tasks/entities/task-link.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { PaginatedTasks, TasksService } from '@/modules/tasks/tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks in a project (with optional filters)' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryTasksDto,
  ): Promise<PaginatedTasks & { success: true }> {
    const result = await this.tasksService.findAll(projectId, query);
    return { success: true, ...result };
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ): Promise<{ success: true; data: Task }> {
    const data = await this.tasksService.create(projectId, user.sub, dto);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  async findOne(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: Task }> {
    const data = await this.tasksService.findById(projectId, id);
    return { success: true, data };
  }

  @Post(':id/log-time')
  @ApiOperation({ summary: 'Log time spent on a task' })
  async logTime(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogTimeDto,
  ): Promise<{ success: true; data: Task }> {
    const data = await this.tasksService.logTime(projectId, id, dto.hours, user.sub);
    return { success: true, data };
  }

  @Patch(':id/move')
  @ApiOperation({
    summary:
      'Move a task to a different column and/or position (drag-and-drop)',
  })
  async move(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MoveTaskDto,
  ): Promise<{ success: true; data: Task }> {
    const data = await this.tasksService.move(projectId, id, dto, user.sub);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTaskDto,
  ): Promise<{ success: true; data: Task }> {
    const data = await this.tasksService.update(projectId, id, dto, user.sub);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.tasksService.remove(projectId, id, user.sub);
    return { success: true, data: null };
  }

  @Get(':id/links')
  @ApiOperation({ summary: 'List links for a task' })
  async findLinks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: TaskLink[] }> {
    const data = await this.tasksService.findLinks(projectId, id);
    return { success: true, data };
  }

  @Post(':id/links')
  @ApiOperation({ summary: 'Link a task to another task' })
  async addLink(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskLinkDto,
  ): Promise<{ success: true; data: TaskLink }> {
    const data = await this.tasksService.addLink(projectId, id, dto);
    return { success: true, data };
  }

  @Delete(':id/links/:linkId')
  @ApiOperation({ summary: 'Remove a task link' })
  async removeLink(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<{ success: true; data: null }> {
    await this.tasksService.removeLink(projectId, id, linkId);
    return { success: true, data: null };
  }
}
