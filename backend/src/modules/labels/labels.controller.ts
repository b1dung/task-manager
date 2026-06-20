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
import { CreateLabelDto } from '@/modules/labels/dto/create-label.dto';
import { UpdateLabelDto } from '@/modules/labels/dto/update-label.dto';
import { Label } from '@/modules/labels/entities/label.entity';
import { LabelsService } from '@/modules/labels/labels.service';

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  @ApiOperation({ summary: 'List project labels' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ success: true; data: Label[] }> {
    const data = await this.labelsService.findAll(projectId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a label' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateLabelDto,
  ): Promise<{ success: true; data: Label }> {
    const data = await this.labelsService.create(projectId, dto);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a label' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabelDto,
  ): Promise<{ success: true; data: Label }> {
    const data = await this.labelsService.update(projectId, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a label' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: null }> {
    await this.labelsService.remove(projectId, id);
    return { success: true, data: null };
  }
}
