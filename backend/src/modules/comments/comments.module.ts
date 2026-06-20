import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@/common/common.module';
import { ActivityModule } from '@/modules/activity/activity.module';
import { CommentsController } from '@/modules/comments/comments.controller';
import { CommentsService } from '@/modules/comments/comments.service';
import { CommentMention } from '@/modules/comments/entities/comment-mention.entity';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { Task } from '@/modules/tasks/entities/task.entity';
import { WebsocketModule } from '@/modules/websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentMention, Task, ProjectMember]),
    CommonModule,
    ActivityModule,
    WebsocketModule,
    NotificationsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
