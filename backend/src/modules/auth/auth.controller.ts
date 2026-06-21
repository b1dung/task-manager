import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { RefreshTokenDto } from '@/modules/auth/dto/refresh-token.dto';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { GoogleAuthGuard } from '@/modules/auth/guards/google-auth.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '@/modules/auth/guards/jwt-refresh.guard';
import { LocalAuthGuard } from '@/modules/auth/guards/local-auth.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { GoogleProfile } from '@/modules/auth/strategies/google.strategy';
import { JwtRefreshPayload } from '@/modules/auth/strategies/jwt-refresh.strategy';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { RateLimitGuard } from '@/modules/auth/guards/rate-limit.guard';
import { RequestPasswordResetDto } from '@/modules/auth/dto/request-password-reset.dto';
import { ResetPasswordDto } from '@/modules/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '@/modules/auth/dto/verify-email.dto';
import { RefreshToken } from '@/modules/auth/entities/refresh-token.entity';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { TwoFactorCodeDto } from '@/modules/auth/dto/two-factor-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @ApiOperation({
    summary:
      'Register a new account. With an invite token the account is activated immediately; otherwise it is created pending admin approval (no tokens returned).',
  })
  @ApiResponse({ status: 201, description: 'Account created' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    if (result.status === 'active') {
      this.setRefreshCookie(res, result.tokens.refreshToken);
      return {
        success: true,
        data: {
          status: 'active',
          user: this.toPublicUser(result.user),
          ...result.tokens,
        },
      };
    }
    return {
      success: true,
      data: { status: 'pending', user: this.toPublicUser(result.user) },
    };
  }

  @UseGuards(LocalAuthGuard)
  @UseGuards(RateLimitGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email & password' })
  @ApiResponse({ status: 200, description: 'Authenticated with tokens' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as User;
    await this.authService.assertValidTwoFactor(
      user.id,
      (req.body as LoginDto).otp,
    );
    const { tokens } = await this.authService.login(user);
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      success: true,
      data: { user: this.toPublicUser(user), ...tokens },
    };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate access & refresh tokens' })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = req.user as JwtRefreshPayload;
    const tokens = await this.authService.refresh(
      payload,
      payload.refreshToken,
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { success: true, data: tokens };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: Partial<RefreshTokenDto>,
  ) {
    const token = dto.refreshToken ?? this.readRefreshCookie(req);
    if (token) await this.authService.logout(user.sub, token);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { success: true, data: null };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.sub);
    return { success: true, data: this.toPublicUser(profile) };
  }

  @Post('password/forgot')
  @UseGuards(RateLimitGuard)
  async forgotPassword(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ success: true; data: null }> {
    await this.authService.requestPasswordReset(dto.email);
    return { success: true, data: null };
  }

  @Post('password/reset')
  @UseGuards(RateLimitGuard)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true; data: null }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { success: true, data: null };
  }

  @Post('email/verify')
  @UseGuards(RateLimitGuard)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<{ success: true; data: null }> {
    await this.authService.verifyEmail(dto.token);
    return { success: true, data: null };
  }

  @Post('email/resend')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async resendVerification(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.authService.sendEmailVerification(
      await this.usersService.findById(payload.sub),
    );
    return { success: true, data: null };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async sessions(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{ success: true; data: RefreshToken[] }> {
    return {
      success: true,
      data: await this.authService.listSessions(payload.sub),
    };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: null }> {
    await this.authService.revokeSession(payload.sub, id);
    return { success: true, data: null };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.authService.revokeAll(payload.sub);
    return { success: true, data: null };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTwoFactor(@CurrentUser() payload: JwtPayload) {
    return {
      success: true,
      data: await this.authService.setupTwoFactor(payload.sub, payload.email),
    };
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async enableTwoFactor(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ success: true; data: null }> {
    await this.authService.enableTwoFactor(payload.sub, dto.code);
    return { success: true, data: null };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async disableTwoFactor(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ success: true; data: null }> {
    await this.authService.disableTwoFactor(payload.sub, dto.code);
    return { success: true, data: null };
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth flow' })
  googleAuth(): void {
    // Redirect handled by Passport strategy
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — issues tokens and redirects to frontend',
  })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user as GoogleProfile;
    const { tokens } =
      await this.authService.loginOrRegisterWithGoogle(profile);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    if (!tokens) {
      // New / not-yet-approved Google account — bounce back with a pending flag.
      res.redirect(`${frontendUrl}/login?pending=1`);
      return;
    }
    this.setRefreshCookie(res, tokens.refreshToken);
    res.redirect(
      `${frontendUrl}/auth/callback#accessToken=${encodeURIComponent(tokens.accessToken)}`,
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookie = req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('refresh_token='));
    return cookie
      ? decodeURIComponent(cookie.slice('refresh_token='.length))
      : undefined;
  }

  private toPublicUser(user: User): Omit<User, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
