import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { QueryNotificationsDto } from '@/modules/notifications/dto/query-notifications.dto';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import {
  NotificationsService,
  PaginatedNotifications,
} from '@/modules/notifications/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryNotificationsDto,
  ): Promise<{
    success: true;
    data: Notification[];
    meta: Record<string, number>;
  }> {
    const result: PaginatedNotifications =
      await this.notificationsService.findAllForUser(user.sub, query);
    return {
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        unreadCount: result.unreadCount,
      },
    };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get the unread notification count for the current user',
  })
  async unreadCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: { count: number } }> {
    const count = await this.notificationsService.countUnread(user.sub);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: Notification }> {
    const data = await this.notificationsService.markAsRead(user.sub, id);
    return { success: true, data };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.notificationsService.markAllAsRead(user.sub);
    return { success: true, data: null };
  }
}
