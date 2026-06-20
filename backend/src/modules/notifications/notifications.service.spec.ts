import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationType } from '@shared/enums';
import { Notification } from '@/modules/notifications/entities/notification.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { TaskboardGateway } from '@/modules/websocket/websocket.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const userId = 'user-1';

  let notificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
    execute: jest.Mock;
  };
  let gateway: { emitNotification: jest.Mock };

  const buildNotification = (
    overrides: Partial<Notification> = {},
  ): Notification =>
    Object.assign(new Notification(), {
      id: 'notification-1',
      recipientId: userId,
      actorId: 'actor-1',
      type: NotificationType.MENTION,
      entityType: 'comment',
      entityId: 'comment-1',
      message: 'You were mentioned',
      readAt: null,
      createdAt: new Date(),
      ...overrides,
    });

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    notificationRepository = {
      create: jest.fn((entity) => Object.assign(new Notification(), entity)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    gateway = { emitNotification: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepository,
        },
        { provide: TaskboardGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('findAllForUser', () => {
    it('paginates and scopes the query to the recipient', async () => {
      const items = [buildNotification()];
      queryBuilder.getManyAndCount.mockResolvedValue([items, 1]);
      notificationRepository.count.mockResolvedValue(1);

      const result = await service.findAllForUser(userId, {
        page: 2,
        limit: 10,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'notification.recipientId = :userId',
        { userId },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        items,
        total: 1,
        unreadCount: 1,
        page: 2,
        limit: 10,
      });
    });

    it('filters to unread notifications when requested', async () => {
      await service.findAllForUser(userId, { unreadOnly: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.readAt IS NULL',
      );
    });
  });

  describe('countUnread', () => {
    it('counts unread notifications for the user', async () => {
      notificationRepository.count.mockResolvedValue(3);

      const result = await service.countUnread(userId);

      expect(notificationRepository.count).toHaveBeenCalledWith({
        where: { recipientId: userId, readAt: expect.anything() },
      });
      expect(result).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('throws when the notification does not belong to the user', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead(userId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets readAt and persists once', async () => {
      const notification = buildNotification();
      notificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.markAsRead(userId, notification.id);

      expect(result.readAt).toBeInstanceOf(Date);
      expect(notificationRepository.save).toHaveBeenCalledWith(notification);
    });

    it('does not re-save an already-read notification', async () => {
      const readAt = new Date('2026-01-01T00:00:00Z');
      const notification = buildNotification({ readAt });
      notificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.markAsRead(userId, notification.id);

      expect(result.readAt).toBe(readAt);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('updates all unread notifications for the user', async () => {
      await service.markAllAsRead(userId);

      expect(queryBuilder.update).toHaveBeenCalledWith(Notification);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'recipient_id = :userId',
        { userId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('read_at IS NULL');
      expect(queryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('persists the notification and emits it to the recipient', async () => {
      const result = await service.create({
        recipientId: userId,
        actorId: 'actor-1',
        type: NotificationType.TASK_ASSIGNED,
        entityType: 'task',
        entityId: 'task-1',
        message: 'You were assigned to "Build feature"',
      });

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(gateway.emitNotification).toHaveBeenCalledWith(userId, result);
      expect(result.readAt).toBeNull();
    });
  });
});
