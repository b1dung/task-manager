import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

const projectRoom = (projectId: string): string => `project:${projectId}`;
const taskRoom = (taskId: string): string => `task:${taskId}`;
const userRoom = (userId: string): string => `user:${userId}`;

@WebSocketGateway({
  cors: { origin: '*' },
})
export class TaskboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TaskboardGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: AuthenticatedSocket): void {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'dev_access_secret',
        ),
      });
      client.data.user = payload;
      void client.join(userRoom(payload.sub));
    } catch {
      this.logger.debug(
        `Rejecting unauthenticated socket connection ${client.id}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(
      `Socket disconnected: ${client.id} (user: ${client.data.user?.sub ?? 'unknown'})`,
    );
  }

  @SubscribeMessage('project:join')
  handleJoinProject(
    client: AuthenticatedSocket,
    payload: { projectId: string },
  ): void {
    if (!payload?.projectId) {
      return;
    }
    void client.join(projectRoom(payload.projectId));
  }

  @SubscribeMessage('project:leave')
  handleLeaveProject(
    client: AuthenticatedSocket,
    payload: { projectId: string },
  ): void {
    if (!payload?.projectId) {
      return;
    }
    void client.leave(projectRoom(payload.projectId));
  }

  @SubscribeMessage('task:join')
  handleJoinTask(
    client: AuthenticatedSocket,
    payload: { taskId: string },
  ): void {
    if (!payload?.taskId) {
      return;
    }
    void client.join(taskRoom(payload.taskId));
  }

  @SubscribeMessage('task:leave')
  handleLeaveTask(
    client: AuthenticatedSocket,
    payload: { taskId: string },
  ): void {
    if (!payload?.taskId) {
      return;
    }
    void client.leave(taskRoom(payload.taskId));
  }

  emitTaskCreated(projectId: string, task: Task): void {
    this.server.to(projectRoom(projectId)).emit('task:created', task);
  }

  emitTaskUpdated(projectId: string, task: Task): void {
    const rooms = [projectRoom(projectId)];
    if (task.assigneeId) {
      rooms.push(userRoom(task.assigneeId));
    }
    this.server.to(rooms).emit('task:updated', task);
  }

  emitTaskMoved(projectId: string, task: Task): void {
    this.server.to(projectRoom(projectId)).emit('task:moved', task);
  }

  emitTaskDeleted(projectId: string, taskId: string): void {
    this.server.to(projectRoom(projectId)).emit('task:deleted', { id: taskId });
  }

  emitCommentAdded(taskId: string, comment: Comment): void {
    this.server.to(taskRoom(taskId)).emit('comment:added', comment);
  }

  emitNotification(recipientId: string, notification: Notification): void {
    this.server
      .to(userRoom(recipientId))
      .emit('notification:new', notification);
  }

  private extractToken(client: AuthenticatedSocket): string {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    throw new Error('No authentication token provided');
  }
}
