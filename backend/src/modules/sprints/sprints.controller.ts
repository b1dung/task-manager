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
import { ProjectMemberGuard } from '@/common/guards/project-member.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CreateSprintDto } from '@/modules/sprints/dto/create-sprint.dto';
import { UpdateSprintDto } from '@/modules/sprints/dto/update-sprint.dto';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { SprintsService } from '@/modules/sprints/sprints.service';

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  @ApiOperation({ summary: 'List project sprints' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ success: true; data: Sprint[] }> {
    const data = await this.sprintsService.findAll(projectId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a sprint' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateSprintDto,
  ): Promise<{ success: true; data: Sprint }> {
    const data = await this.sprintsService.create(projectId, dto);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sprint' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSprintDto,
  ): Promise<{ success: true; data: Sprint }> {
    const data = await this.sprintsService.update(projectId, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sprint' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: null }> {
    await this.sprintsService.remove(projectId, id);
    return { success: true, data: null };
  }
}
