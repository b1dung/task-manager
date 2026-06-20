import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { CreateInviteDto } from '@/modules/invites/dto/create-invite.dto';
import { Invite } from '@/modules/invites/entities/invite.entity';
import { InvitesService } from '@/modules/invites/invites.service';

interface InviteView {
  id: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@ApiTags('invites')
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly configService: ConfigService,
  ) {}

  private toView(invite: Invite): InviteView {
    return {
      id: invite.id,
      email: invite.email,
      roleId: invite.roleId,
      roleName: invite.role?.name ?? null,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  private buildLink(token: string): string {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    return `${frontendUrl}/register?token=${token}`;
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('manage_users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invite link (requires manage_users)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInviteDto,
  ): Promise<{ success: true; data: InviteView & { link: string } }> {
    const { invite, token } = await this.invitesService.create(
      dto.email,
      dto.roleId ?? null,
      user.sub,
    );
    return {
      success: true,
      data: { ...this.toView(invite), link: this.buildLink(token) },
    };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: 'List pending invites (requires manage_users)' })
  async findPending(): Promise<{ success: true; data: InviteView[] }> {
    const invites = await this.invitesService.findPending();
    return { success: true, data: invites.map((i) => this.toView(i)) };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: 'Revoke a pending invite (requires manage_users)' })
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: null }> {
    await this.invitesService.revoke(id);
    return { success: true, data: null };
  }

  @Get('validate')
  @ApiOperation({
    summary: 'Validate an invite token (public — used by the register page)',
  })
  async validate(
    @Query('token') token?: string,
  ): Promise<{ success: true; data: { email: string; roleName: string | null } }> {
    const invite = await this.invitesService.findValidByToken(token ?? '');
    if (!invite) {
      throw new BadRequestException('Lời mời không hợp lệ hoặc đã hết hạn');
    }
    return {
      success: true,
      data: { email: invite.email, roleName: invite.role?.name ?? null },
    };
  }
}
