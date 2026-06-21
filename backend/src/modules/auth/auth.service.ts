import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
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
import {
  AccountToken,
  AccountTokenType,
} from '@/modules/auth/entities/account-token.entity';
import { MailService } from '@/common/mail/mail.service';
import { createTotpSecret, verifyTotp } from '@/modules/auth/totp';

const PENDING_APPROVAL_MESSAGE =
  'Tài khoản của bạn đang chờ quản trị viên duyệt và phân quyền';

export type RegisterResult =
  | { status: 'active'; user: User; tokens: AuthTokens }
  | { status: 'pending'; user: User };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly invitesService: InvitesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(AccountToken)
    private readonly accountTokenRepository: Repository<AccountToken>,
    private readonly mailService: MailService,
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
        throw new BadRequestException('Lời mời không hợp lệ hoặc đã hết hạn');
      }
      const user = await this.usersService.create({
        email: invite.email,
        passwordHash,
        fullName: params.fullName,
        isActive: true,
        roleId: invite.roleId,
      });
      await this.invitesService.markAccepted(invite.id);
      void this.sendEmailVerification(user).catch((error: Error) =>
        this.logger.error(
          `Unable to send verification email: ${error.message}`,
        ),
      );
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
    void this.sendEmailVerification(user).catch((error: Error) =>
      this.logger.error(`Unable to send verification email: ${error.message}`),
    );
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

  async assertValidTwoFactor(userId: string, code?: string): Promise<void> {
    const user = await this.usersService.findWithTwoFactorSecret(userId);
    if (!user?.twoFactorEnabled) return;
    if (
      !user.twoFactorSecret ||
      !code ||
      !verifyTotp(this.decryptSecret(user.twoFactorSecret), code)
    ) {
      throw new UnauthorizedException(
        'A valid two-factor authentication code is required',
      );
    }
  }

  async setupTwoFactor(
    userId: string,
    email: string,
  ): Promise<{ secret: string; uri: string }> {
    const secret = createTotpSecret();
    await this.usersService.setTwoFactor(
      userId,
      this.encryptSecret(secret),
      false,
    );
    const label = encodeURIComponent(`TaskBoard:${email}`);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=TaskBoard&digits=6&period=30`;
    return { secret, uri };
  }

  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findWithTwoFactorSecret(userId);
    if (
      !user?.twoFactorSecret ||
      !verifyTotp(this.decryptSecret(user.twoFactorSecret), code)
    ) {
      throw new BadRequestException('Invalid two-factor authentication code');
    }
    await this.usersService.setTwoFactor(userId, user.twoFactorSecret, true);
  }

  async disableTwoFactor(userId: string, code: string): Promise<void> {
    await this.assertValidTwoFactor(userId, code);
    await this.usersService.setTwoFactor(userId, null, false);
    await this.revokeAll(userId);
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
      await this.usersService.markEmailVerified(user.id);
      user.emailVerifiedAt = new Date();
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

    const rotation = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('id = :id AND revoked_at IS NULL AND expires_at > NOW()', {
        id: stored.id,
      })
      .execute();
    if (rotation.affected !== 1) {
      await this.revokeAll(payload.sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

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

  async listSessions(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { id: sessionId, userId },
      { revokedAt: new Date() },
    );
  }

  async revokeAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithPassword(
      email.trim().toLowerCase(),
    );
    if (!user) return;
    const token = await this.createAccountToken(user.id, 'password_reset', 30);
    const frontend = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    await this.mailService.send(
      user.email,
      'Reset your TaskBoard password',
      `Reset your password: ${frontend}/reset-password?token=${encodeURIComponent(token)}`,
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const accountToken = await this.consumeAccountToken(
      token,
      'password_reset',
    );
    await this.usersService.setPassword(accountToken.userId, password);
    await this.revokeAll(accountToken.userId);
  }

  async sendEmailVerification(user: User): Promise<void> {
    if (user.emailVerifiedAt) return;
    const token = await this.createAccountToken(
      user.id,
      'email_verification',
      24 * 60,
    );
    const frontend = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    await this.mailService.send(
      user.email,
      'Verify your TaskBoard email',
      `Verify your email: ${frontend}/verify-email?token=${encodeURIComponent(token)}`,
    );
  }

  async verifyEmail(token: string): Promise<void> {
    const accountToken = await this.consumeAccountToken(
      token,
      'email_verification',
    );
    await this.usersService.markEmailVerified(accountToken.userId);
  }

  private async createAccountToken(
    userId: string,
    type: AccountTokenType,
    ttlMinutes: number,
  ): Promise<string> {
    await this.accountTokenRepository.delete({
      userId,
      type,
      usedAt: IsNull(),
    });
    const token = randomBytes(32).toString('hex');
    await this.accountTokenRepository.save(
      this.accountTokenRepository.create({
        userId,
        type,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        usedAt: null,
      }),
    );
    return token;
  }

  private async consumeAccountToken(
    token: string,
    type: AccountTokenType,
  ): Promise<AccountToken> {
    const tokenHash = this.hashToken(token);
    const found = await this.accountTokenRepository
      .createQueryBuilder('token')
      .addSelect('token.tokenHash')
      .where('token.tokenHash = :tokenHash', { tokenHash })
      .andWhere('token.type = :type', { type })
      .andWhere('token.usedAt IS NULL')
      .andWhere('token.expiresAt > NOW()')
      .getOne();
    if (!found) throw new BadRequestException('Token is invalid or expired');
    const result = await this.accountTokenRepository
      .createQueryBuilder()
      .update(AccountToken)
      .set({ usedAt: new Date() })
      .where('id = :id AND used_at IS NULL', { id: found.id })
      .execute();
    if (result.affected !== 1)
      throw new BadRequestException('Token has already been used');
    return found;
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

  private encryptionKey(): Buffer {
    return createHash('sha256')
      .update(
        this.configService.get<string>(
          'TWO_FACTOR_ENCRYPTION_KEY',
          this.configService.get<string>(
            'JWT_REFRESH_SECRET',
            'dev_refresh_secret',
          ),
        ),
      )
      .digest();
  }

  private encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptSecret(value: string): string {
    const [iv, tag, encrypted] = value
      .split(':')
      .map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
