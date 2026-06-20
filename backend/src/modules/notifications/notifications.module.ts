import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { User } from '@/modules/users/entities/user.entity';
import { NotificationsController } from '@/modules/notifications/notifications.controller';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { WebsocketModule } from '@/modules/websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, ProjectMember, User]),
    WebsocketModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
