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
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { ColumnsService } from '@/modules/columns/columns.service';
import { CreateColumnDto } from '@/modules/columns/dto/create-column.dto';
import { ReorderColumnsDto } from '@/modules/columns/dto/reorder-columns.dto';
import { UpdateColumnDto } from '@/modules/columns/dto/update-column.dto';
import { BoardColumn } from '@/modules/columns/entities/column.entity';

@ApiTags('columns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard, PermissionsGuard)
@Controller('projects/:projectId/columns')
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Get()
  @ApiOperation({ summary: 'List board columns ordered by position' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<{ success: true; data: BoardColumn[] }> {
    const data = await this.columnsService.findAll(projectId);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Create a board column' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateColumnDto,
  ): Promise<{ success: true; data: BoardColumn }> {
    const data = await this.columnsService.create(projectId, dto);
    return { success: true, data };
  }

  @Patch('reorder')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Reorder board columns' })
  async reorder(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ReorderColumnsDto,
  ): Promise<{ success: true; data: BoardColumn[] }> {
    const data = await this.columnsService.reorder(projectId, dto.columnIds);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Update a board column' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColumnDto,
  ): Promise<{ success: true; data: BoardColumn }> {
    const data = await this.columnsService.update(projectId, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('edit_project')
  @ApiOperation({ summary: 'Delete a board column' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: null }> {
    await this.columnsService.remove(projectId, id);
    return { success: true, data: null };
  }
}
