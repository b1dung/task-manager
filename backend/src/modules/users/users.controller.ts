import {
  Body,
  Controller,
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
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get()
  @ApiOperation({ summary: 'List / search users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(
    @Query('q') q?: string,
  ): Promise<{ success: true; data: User[] }> {
    const data = await this.usersService.findAll(q);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: User }> {
    const data = await this.usersService.findById(id);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user profile (self; manage_users to edit others/role/status)',
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
    const data = await this.usersService.update(id, dto);
    return { success: true, data };
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
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requester: JwtPayload,
    @UserPermissions() permissions: string[],
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: User }> {
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
