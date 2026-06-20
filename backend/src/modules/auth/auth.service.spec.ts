import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@shared/enums';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import { InvitesService } from '@/modules/invites/invites.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'create' | 'findByEmailWithPassword' | 'findById' | 'updateAvatar'
    >
  >;
  let refreshTokenRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let invitesService: jest.Mocked<
    Pick<InvitesService, 'findValidByToken' | 'markAccepted'>
  >;

  const buildUser = (overrides: Partial<User> = {}): User => {
    const user = new User();
    user.id = 'user-1';
    user.email = 'jane@example.com';
    user.passwordHash = '';
    user.fullName = 'Jane Doe';
    user.avatarUrl = null;
    user.role = UserRole.MEMBER;
    user.isActive = true;
    user.createdAt = new Date();
    return Object.assign(user, overrides);
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
      updateAvatar: jest.fn(),
    };
    refreshTokenRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    };
    invitesService = {
      findValidByToken: jest.fn(),
      markAccepted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: InvitesService, useValue: invitesService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: new ConfigService() },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('public registration creates a pending (inactive) user with no tokens', async () => {
      const created = buildUser({ passwordHash: 'hashed', isActive: false });
      usersService.create.mockResolvedValue(created);

      const result = await service.register({
        email: 'jane@example.com',
        password: 'StrongPass123',
        fullName: 'Jane Doe',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          isActive: false,
        }),
      );
      expect(result.status).toBe('pending');
      expect(result).not.toHaveProperty('tokens');
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('invite registration activates the user, assigns the role and issues tokens', async () => {
      invitesService.findValidByToken.mockResolvedValue({
        id: 'inv-1',
        email: 'invited@example.com',
        roleId: 'role-1',
      } as never);
      const created = buildUser({
        email: 'invited@example.com',
        roleId: 'role-1',
      });
      usersService.create.mockResolvedValue(created);

      const result = await service.register({
        token: 'raw-token',
        password: 'StrongPass123',
        fullName: 'Invited User',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'invited@example.com',
          isActive: true,
          roleId: 'role-1',
        }),
      );
      expect(invitesService.markAccepted).toHaveBeenCalledWith('inv-1');
      expect(result.status).toBe('active');
      if (result.status === 'active') {
        expect(result.tokens.accessToken).toBe('signed-token');
      }
    });
  });

  describe('validateCredentials', () => {
    it('returns null when no user is found', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      const result = await service.validateCredentials(
        'missing@example.com',
        'whatever',
      );

      expect(result).toBeNull();
    });

    it('returns null when the password does not match', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        buildUser({ passwordHash: hashed }),
      );

      const result = await service.validateCredentials(
        'jane@example.com',
        'wrong-password',
      );

      expect(result).toBeNull();
    });

    it('returns the user when the password matches', async () => {
      const hashed = await bcrypt.hash('correct-password', 4);
      const user = buildUser({ passwordHash: hashed });
      usersService.findByEmailWithPassword.mockResolvedValue(user);

      const result = await service.validateCredentials(
        'jane@example.com',
        'correct-password',
      );

      expect(result).toBe(user);
    });
  });

  describe('login', () => {
    it('issues tokens for an active user', async () => {
      const user = buildUser();

      const result = await service.login(user);

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBe('signed-token');
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });

    it('rejects a pending (inactive) user', async () => {
      const user = buildUser({ isActive: false });

      await expect(service.login(user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('loginOrRegisterWithGoogle', () => {
    it('throws when the Google profile has no email', async () => {
      await expect(
        service.loginOrRegisterWithGoogle({
          email: '',
          fullName: 'Jane',
          avatarUrl: null,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a new user when none exists for the email', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      const created = buildUser({ email: 'new@example.com' });
      usersService.create.mockResolvedValue(created);

      const result = await service.loginOrRegisterWithGoogle({
        email: 'new@example.com',
        fullName: 'New User',
        avatarUrl: null,
      });

      expect(usersService.create).toHaveBeenCalled();
      expect(result.user).toBe(created);
    });

    it('reuses an existing user matched by email', async () => {
      const existing = buildUser({ email: 'jane@example.com' });
      usersService.findByEmailWithPassword.mockResolvedValue(existing);

      const result = await service.loginOrRegisterWithGoogle({
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        avatarUrl: null,
      });

      expect(usersService.create).not.toHaveBeenCalled();
      expect(result.user).toBe(existing);
    });
  });

  describe('refresh', () => {
    const payload = {
      sub: 'user-1',
      email: 'jane@example.com',
      role: UserRole.MEMBER,
    };

    it('throws when no stored token matches', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refresh(payload, 'presented-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('revokes the old token and issues new tokens', async () => {
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
      });
      usersService.findById.mockResolvedValue(buildUser());

      const tokens = await service.refresh(payload, 'presented-token');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        'rt-1',
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(tokens.accessToken).toBe('signed-token');
    });
  });

  describe('logout', () => {
    it('revokes the refresh token matching the user and hash', async () => {
      await service.logout('user-1', 'presented-token');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', tokenHash: expect.any(String) },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });
});
