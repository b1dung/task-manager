import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import {
  AuthTokens,
  JwtPayload,
} from '@/modules/auth/interfaces/jwt-payload.interface';
import { GoogleProfile } from '@/modules/auth/strategies/google.strategy';
import { InvitesService } from '@/modules/invites/invites.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

const PENDING_APPROVAL_MESSAGE =
  'Tài khoản của bạn đang chờ quản trị viên duyệt và phân quyền';

export type RegisterResult =
  | { status: 'active'; user: User; tokens: AuthTokens }
  | { status: 'pending'; user: User };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitesService: InvitesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Register a new account.
   *  - With a valid invite token: activated immediately with the invited role.
   *  - Public (no token): created pending (inactive) — an admin/owner must
   *    approve and assign permissions before the user can log in.
   */
  async register(params: {
    token?: string;
    email?: string;
    password: string;
    fullName: string;
  }): Promise<RegisterResult> {
    const passwordHash = await bcrypt.hash(params.password, 10);

    if (params.token) {
      const invite = await this.invitesService.findValidByToken(params.token);
      if (!invite) {
        throw new BadRequestException(
          'Lời mời không hợp lệ hoặc đã hết hạn',
        );
      }
      const user = await this.usersService.create({
        email: invite.email,
        passwordHash,
        fullName: params.fullName,
        isActive: true,
        roleId: invite.roleId,
      });
      await this.invitesService.markAccepted(invite.id);
      const tokens = await this.issueTokens(user);
      return { status: 'active', user, tokens };
    }

    if (!params.email) {
      throw new BadRequestException('Email là bắt buộc');
    }
    const user = await this.usersService.create({
      email: params.email.trim().toLowerCase(),
      passwordHash,
      fullName: params.fullName,
      isActive: false,
    });
    return { status: 'pending', user };
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  async login(user: User): Promise<{ user: User; tokens: AuthTokens }> {
    if (!user.isActive) {
      throw new ForbiddenException(PENDING_APPROVAL_MESSAGE);
    }
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /** Google OAuth: existing active users sign in; brand-new accounts are created
   * pending (inactive) and must be approved, just like public registration. */
  async loginOrRegisterWithGoogle(
    profile: GoogleProfile,
  ): Promise<{ user: User; tokens: AuthTokens | null }> {
    if (!profile.email) {
      throw new ConflictException('Google account has no email');
    }
    let user = await this.usersService.findByEmailWithPassword(profile.email);
    if (!user) {
      const randomPassword = await bcrypt.hash(
        `${Date.now()}-${Math.random()}`,
        10,
      );
      user = await this.usersService.create({
        email: profile.email,
        passwordHash: randomPassword,
        fullName: profile.fullName || profile.email,
        isActive: false,
      });
      if (profile.avatarUrl) {
        user = await this.usersService.updateAvatar(user.id, profile.avatarUrl);
      }
    }
    if (!user.isActive) {
      return { user, tokens: null };
    }
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(
    payload: JwtPayload,
    presentedToken: string,
  ): Promise<AuthTokens> {
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.refreshTokenRepository.update(stored.id, {
      revokedAt: new Date(),
    });

    const user = await this.usersService.findById(payload.sub);
    if (!user.isActive) {
      throw new ForbiddenException(PENDING_APPROVAL_MESSAGE);
    }
    return this.issueTokens(user);
  }

  async logout(userId: string, presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.refreshTokenRepository.update(
      { userId, tokenHash },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roleId: user.roleId ?? null,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev_access_secret',
      ),
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as unknown as number,
    });

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'dev_refresh_secret',
        ),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as unknown as number,
      },
    );

    await this.persistRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    const expiresInDays = 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const entity = this.refreshTokenRepository.create({
      userId,
      tokenHash: this.hashToken(token),
      expiresAt,
      revokedAt: null,
    });
    await this.refreshTokenRepository.save(entity);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
