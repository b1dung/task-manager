import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  NotificationType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@shared/enums';
import { Comment } from '@/modules/comments/entities/comment.entity';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { Task } from '@/modules/tasks/entities/task.entity';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';
import { UsersService } from '@/modules/users/users.service';

describe('TaskboardGateway', () => {
  let gateway: TaskboardGateway;
  let jwtService: { verify: jest.Mock };
  let configService: { get: jest.Mock };
  let emit: jest.Mock;
  let to: jest.Mock;
  let server: { to: jest.Mock };
  let usersService: { findActiveById: jest.Mock };
  let projectMemberRepository: { findOne: jest.Mock };
  let taskRepository: { createQueryBuilder: jest.Mock };

  const buildSocket = (overrides: Record<string, unknown> = {}) => {
    const join = jest.fn();
    const leave = jest.fn();
    const disconnect = jest.fn();
    return {
      id: 'socket-1',
      data: {} as { user?: { sub: string; email?: string } },
      handshake: { auth: {}, headers: {}, query: {} },
      join,
      leave,
      disconnect,
      ...overrides,
    };
  };

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('dev_access_secret') };
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    server = { to };
    usersService = {
      findActiveById: jest.fn((id: string) =>
        Promise.resolve({
          id,
          email: `${id}@example.com`,
          role: 'member',
          roleId: null,
        }),
      ),
    };
    projectMemberRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'member-1' }),
    };
    taskRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'task-1' }),
      }),
    };

    gateway = new TaskboardGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      usersService as unknown as UsersService,
      projectMemberRepository as never,
      taskRepository as never,
    );
    gateway.server = server as never;
  });

  describe('handleConnection', () => {
    it('authenticates via handshake.auth.token and joins the personal room', async () => {
      const socket = buildSocket({
        handshake: { auth: { token: 'token-1' }, headers: {}, query: {} },
      });
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'user@example.com',
      });

      await gateway.handleConnection(socket as never);

      expect(jwtService.verify).toHaveBeenCalledWith('token-1', {
        secret: 'dev_access_secret',
      });
      expect(socket.data.user?.sub).toBe('user-1');
      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('authenticates via the Authorization header when no auth.token is present', async () => {
      const socket = buildSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer token-2' },
          query: {},
        },
      });
      jwtService.verify.mockReturnValue({ sub: 'user-2' });

      await gateway.handleConnection(socket as never);

      expect(jwtService.verify).toHaveBeenCalledWith('token-2', {
        secret: 'dev_access_secret',
      });
      expect(socket.join).toHaveBeenCalledWith('user:user-2');
    });

    it('authenticates via the query token as a last resort', async () => {
      const socket = buildSocket({
        handshake: { auth: {}, headers: {}, query: { token: 'token-3' } },
      });
      jwtService.verify.mockReturnValue({ sub: 'user-3' });

      await gateway.handleConnection(socket as never);

      expect(jwtService.verify).toHaveBeenCalledWith('token-3', {
        secret: 'dev_access_secret',
      });
      expect(socket.join).toHaveBeenCalledWith('user:user-3');
    });

    it('disconnects the socket when no token is provided', async () => {
      const socket = buildSocket();

      await gateway.handleConnection(socket as never);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects the socket when the token is invalid', async () => {
      const socket = buildSocket({
        handshake: { auth: { token: 'bad-token' }, headers: {}, query: {} },
      });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw for an authenticated or anonymous socket', () => {
      const socket = buildSocket({ data: { user: { sub: 'user-1' } } });

      expect(() => gateway.handleDisconnect(socket as never)).not.toThrow();
      expect(() =>
        gateway.handleDisconnect(buildSocket() as never),
      ).not.toThrow();
    });
  });

  describe('room join/leave handlers', () => {
    it('joins and leaves a project room', async () => {
      const socket = buildSocket({ data: { user: { sub: 'user-1' } } });

      await gateway.handleJoinProject(socket as never, {
        projectId: 'project-1',
      });
      gateway.handleLeaveProject(socket as never, { projectId: 'project-1' });

      expect(socket.join).toHaveBeenCalledWith('project:project-1');
      expect(socket.leave).toHaveBeenCalledWith('project:project-1');
    });

    it('joins and leaves a task room', async () => {
      const socket = buildSocket({ data: { user: { sub: 'user-1' } } });

      await gateway.handleJoinTask(socket as never, { taskId: 'task-1' });
      gateway.handleLeaveTask(socket as never, { taskId: 'task-1' });

      expect(socket.join).toHaveBeenCalledWith('task:task-1');
      expect(socket.leave).toHaveBeenCalledWith('task:task-1');
    });

    it('ignores join/leave events without an identifier', () => {
      const socket = buildSocket();

      gateway.handleJoinProject(socket as never, {} as never);
      gateway.handleJoinTask(socket as never, {} as never);

      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  const buildTask = (overrides: Partial<Task> = {}): Task =>
    Object.assign(new Task(), {
      id: 'task-1',
      projectId: 'project-1',
      columnId: 'col-1',
      title: 'Task',
      type: TaskType.TASK,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      assigneeId: null,
      reporterId: 'reporter-1',
      position: 0,
      ...overrides,
    });

  describe('emit helpers', () => {
    it('emits task:created to the project room', () => {
      const task = buildTask();

      gateway.emitTaskCreated('project-1', task);

      expect(to).toHaveBeenCalledWith('project:project-1');
      expect(emit).toHaveBeenCalledWith('task:created', task);
    });

    it('emits task:updated to the project room and the assignee room when assigned', () => {
      const task = buildTask({ assigneeId: 'assignee-1' });

      gateway.emitTaskUpdated('project-1', task);

      expect(to).toHaveBeenCalledWith(['project:project-1', 'user:assignee-1']);
      expect(emit).toHaveBeenCalledWith('task:updated', task);
    });

    it('emits task:updated only to the project room when unassigned', () => {
      const task = buildTask({ assigneeId: null });

      gateway.emitTaskUpdated('project-1', task);

      expect(to).toHaveBeenCalledWith(['project:project-1']);
      expect(emit).toHaveBeenCalledWith('task:updated', task);
    });

    it('emits task:moved to the project room', () => {
      const task = buildTask();

      gateway.emitTaskMoved('project-1', task);

      expect(to).toHaveBeenCalledWith('project:project-1');
      expect(emit).toHaveBeenCalledWith('task:moved', task);
    });

    it('emits task:deleted to the project room with the task id', () => {
      gateway.emitTaskDeleted('project-1', 'task-1');

      expect(to).toHaveBeenCalledWith('project:project-1');
      expect(emit).toHaveBeenCalledWith('task:deleted', { id: 'task-1' });
    });

    it('emits comment:added to the task room', () => {
      const comment = Object.assign(new Comment(), {
        id: 'comment-1',
        taskId: 'task-1',
        content: 'Hi',
      });

      gateway.emitCommentAdded('task-1', comment);

      expect(to).toHaveBeenCalledWith('task:task-1');
      expect(emit).toHaveBeenCalledWith('comment:added', comment);
    });

    it('emits notification:new to the recipient personal room', () => {
      const notification = Object.assign(new Notification(), {
        id: 'notification-1',
        recipientId: 'user-1',
        type: NotificationType.MENTION,
        message: 'You were mentioned',
      });

      gateway.emitNotification('user-1', notification);

      expect(to).toHaveBeenCalledWith('user:user-1');
      expect(emit).toHaveBeenCalledWith('notification:new', notification);
    });
  });
});
