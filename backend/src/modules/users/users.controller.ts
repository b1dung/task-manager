import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequirePermissions } from '@/modules/auth/decorators/require-permissions.decorator';
import { UserPermissions } from '@/modules/auth/decorators/user-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { UsersService } from '@/modules/users/users.service';
import { ChangePasswordDto } from '@/modules/users/dto/change-password.dto';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { User } from '@/modules/users/entities/user.entity';
import { RolesService } from '@/modules/roles/roles.service';
import { assertFileSignature } from '@/common/files/file-signature';
import { DeleteAccountDto } from '@/modules/users/dto/delete-account.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {}

  @Get('me/export')
  async exportOwnData(
    @CurrentUser() requester: JwtPayload,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return {
      success: true,
      data: await this.usersService.exportOwnData(requester.sub),
    };
  }

  @Delete('me')
  async deleteOwnAccount(
    @CurrentUser() requester: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ success: true; data: null }> {
    await this.usersService.deleteOwnAccount(
      requester.sub,
      dto.currentPassword,
    );
    return { success: true, data: null };
  }

  @Post()
  @RequirePermissions('manage_users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user (requires manage_users)' })
  async create(
    @Body() dto: CreateUserDto,
  ): Promise<{ success: true; data: User }> {
    const data = await this.usersService.adminCreate(dto);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('manage_users')
  @ApiOperation({
    summary:
      'Delete a user and their owned projects (requires manage_users; cannot delete self or the last owner)',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    const target = await this.usersService.findById(id);
    const targetRole = await this.rolesService.getEffectivePermissions(target);
    if (targetRole.roleKey === 'owner') {
      const actorRole =
        await this.rolesService.getEffectivePermissions(requester);
      if (actorRole.roleKey !== 'owner') {
        throw new ForbiddenException(
          'Only an owner can delete an owner account',
        );
      }
      const ownerRole = await this.rolesService.findByKey('owner');
      if (
        ownerRole &&
        (await this.usersService.countActiveByRoleId(ownerRole.id)) <= 1
      ) {
        throw new ForbiddenException('The last active owner cannot be deleted');
      }
    }
    await this.usersService.remove(id, requester.sub);
    return { success: true, data: null };
  }

  @Get()
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: 'List / search users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(
    @Query('q') q?: string,
  ): Promise<{ success: true; data: User[] }> {
    const data = await this.usersService.findAll(q);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('manage_users')
  @ApiOperation({ summary: 'Get a user by id' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: User }> {
    const data = await this.usersService.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a user profile (self; manage_users to edit others/role/status)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
    @UserPermissions() permissions: string[],
    @Body() dto: UpdateUserDto,
  ): Promise<{ success: true; data: User }> {
    const canManageUsers = permissions.includes('manage_users');
    if (!canManageUsers) {
      if (requester.sub !== id) {
        throw new ForbiddenException('You can only edit your own profile');
      }
      if (
        dto.role !== undefined ||
        dto.email !== undefined ||
        dto.isActive !== undefined ||
        dto.roleId !== undefined
      ) {
        throw new ForbiddenException(
          'You do not have permission to change role, email or account status',
        );
      }
    }
    if (
      canManageUsers &&
      (dto.roleId !== undefined || dto.isActive !== undefined)
    ) {
      const actorRole =
        await this.rolesService.getEffectivePermissions(requester);
      const target = await this.usersService.findById(id);
      const targetRole =
        await this.rolesService.getEffectivePermissions(target);
      const nextRole = dto.roleId
        ? await this.rolesService.findOne(dto.roleId)
        : null;
      if (
        (targetRole.roleKey === 'owner' || nextRole?.key === 'owner') &&
        actorRole.roleKey !== 'owner'
      ) {
        throw new ForbiddenException(
          'Only an owner can modify or assign the Owner role',
        );
      }
      if (requester.sub === id && dto.isActive === false) {
        throw new ForbiddenException('You cannot deactivate your own account');
      }
      if (
        targetRole.roleKey === 'owner' &&
        (dto.isActive === false ||
          (dto.roleId !== undefined && nextRole?.key !== 'owner'))
      ) {
        const ownerRole = await this.rolesService.findByKey('owner');
        if (
          ownerRole &&
          (await this.usersService.countActiveByRoleId(ownerRole.id)) <= 1
        ) {
          throw new ForbiddenException(
            'The last active owner cannot be removed or deactivated',
          );
        }
      }
    }
    const data = await this.usersService.update(id, dto);
    return { success: true, data };
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Change your own password' })
  async changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true; data: null }> {
    if (requester.sub !== id) {
      throw new ForbiddenException('You can only change your own password');
    }
    await this.usersService.changePassword(
      id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true, data: null };
  }

  @Patch(':id/avatar')
  @ApiOperation({ summary: 'Upload / replace avatar image' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp'].includes(
          file.mimetype,
        );
        cb(
          allowed
            ? null
            : new BadRequestException('Avatar must be PNG, JPEG, or WebP'),
          allowed,
        );
      },
    }),
  )
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
    @UserPermissions() permissions: string[],
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: User }> {
    if (!file) throw new BadRequestException('An avatar file is required');
    await assertFileSignature(file);
    if (!permissions.includes('manage_users') && requester.sub !== id) {
      throw new ForbiddenException('You can only change your own avatar');
    }
    const data = await this.usersService.updateAvatar(
      id,
      `/uploads/avatars/${file.filename}`,
    );
    return { success: true, data };
  }
}
