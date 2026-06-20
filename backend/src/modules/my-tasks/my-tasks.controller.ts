import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import {
  MyTasksQuery,
  MyTasksService,
  MyTaskStats,
} from '@/modules/my-tasks/my-tasks.service';
import { Task } from '@/modules/tasks/entities/task.entity';

@ApiTags('my-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/tasks')
export class MyTasksController {
  constructor(private readonly myTasksService: MyTasksService) {}

  @Get()
  @ApiOperation({
    summary: 'Tasks assigned to / created by the current user (across projects)',
  })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: MyTasksQuery,
  ): Promise<{ success: true; data: { items: Task[]; stats: MyTaskStats } }> {
    const data = await this.myTasksService.findForUser(user.sub, query);
    return { success: true, data };
  }
}
