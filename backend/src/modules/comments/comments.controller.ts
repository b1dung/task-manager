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
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { CommentsService } from '@/modules/comments/comments.service';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { Comment } from '@/modules/comments/entities/comment.entity';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@Controller('projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List comments on a task' })
  async findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<{ success: true; data: Comment[] }> {
    const data = await this.commentsService.findAllForTask(projectId, taskId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment (supports replies and mentions)' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ): Promise<{ success: true; data: Comment }> {
    const data = await this.commentsService.create(
      projectId,
      taskId,
      user.sub,
      dto,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit your own comment' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateCommentDto,
  ): Promise<{ success: true; data: Comment }> {
    const data = await this.commentsService.update(
      projectId,
      taskId,
      id,
      user.sub,
      dto,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete your own comment' })
  async remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.commentsService.remove(projectId, taskId, id, user.sub);
    return { success: true, data: null };
  }
}
