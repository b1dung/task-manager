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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { UsersService } from '@/modules/users/users.service';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtPayload;
  };
}

const projectRoom = (projectId: string): string => `project:${projectId}`;
const taskRoom = (taskId: string): string => `task:${taskId}`;
const userRoom = (userId: string): string => `user:${userId}`;

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
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
    private readonly usersService: UsersService,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'dev_access_secret',
        ),
      });
      const user = await this.usersService.findActiveById(payload.sub);
      if (!user) throw new Error('Inactive account');
      client.data.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
      };
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
  async handleJoinProject(
    client: AuthenticatedSocket,
    payload: { projectId: string },
  ): Promise<void> {
    if (!payload?.projectId || !client.data.user) {
      return;
    }
    const member = await this.projectMemberRepository.findOne({
      where: { projectId: payload.projectId, userId: client.data.user.sub },
    });
    if (member) void client.join(projectRoom(payload.projectId));
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
  async handleJoinTask(
    client: AuthenticatedSocket,
    payload: { taskId: string },
  ): Promise<void> {
    if (!payload?.taskId || !client.data.user) {
      return;
    }
    const task = await this.taskRepository
      .createQueryBuilder('task')
      .innerJoin(
        ProjectMember,
        'pm',
        'pm.project_id = task.project_id AND pm.user_id = :userId',
        { userId: client.data.user.sub },
      )
      .where('task.id = :taskId', { taskId: payload.taskId })
      .getOne();
    if (task) void client.join(taskRoom(payload.taskId));
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
