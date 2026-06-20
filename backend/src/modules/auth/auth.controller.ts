import {
  Body,
  Controller,
  Get,
  Post,
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary:
      'Register a new account. With an invite token the account is activated immediately; otherwise it is created pending admin approval (no tokens returned).',
  })
  @ApiResponse({ status: 201, description: 'Account created' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    if (result.status === 'active') {
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
  @Post('login')
  @ApiOperation({ summary: 'Login with email & password' })
  @ApiResponse({ status: 200, description: 'Authenticated with tokens' })
  async login(@Req() req: Request) {
    const user = req.user as User;
    const { tokens } = await this.authService.login(user);
    return {
      success: true,
      data: { user: this.toPublicUser(user), ...tokens },
    };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate access & refresh tokens' })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(@Req() req: Request) {
    const payload = req.user as JwtRefreshPayload;
    const tokens = await this.authService.refresh(
      payload,
      payload.refreshToken,
    );
    return { success: true, data: tokens };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(user.sub, dto.refreshToken);
    return { success: true, data: null };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser() user: JwtPayload) {
    return { success: true, data: user };
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
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
    );
  }

  private toPublicUser(user: User): Omit<User, 'passwordHash'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
