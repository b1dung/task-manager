import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '@/modules/auth/decorators/require-permissions.decorator';
import { UserPermissions } from '@/modules/auth/decorators/user-permissions.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { CreateRoleDto } from '@/modules/roles/dto/create-role.dto';
import { UpdateRoleDto } from '@/modules/roles/dto/update-role.dto';
import { Role } from '@/modules/roles/entities/role.entity';
import {
  EffectivePermissions,
  RolesService,
} from '@/modules/roles/roles.service';
import { PermissionDef } from '@/modules/roles/permissions.catalog';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('me/permissions')
  @ApiOperation({ summary: 'Effective permissions for the current user' })
  async myPermissions(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: EffectivePermissions }> {
    const data = await this.rolesService.getEffectivePermissions(user);
    return { success: true, data };
  }

  @Get('permissions')
  @RequireAnyPermissions('manage_roles', 'manage_users')
  @ApiOperation({ summary: 'List the catalog of all available permissions' })
  getPermissions(): { success: true; data: PermissionDef[] } {
    return { success: true, data: this.rolesService.getPermissionCatalog() };
  }

  @Get('roles')
  @RequireAnyPermissions('manage_roles', 'manage_users')
  @ApiOperation({ summary: 'List all roles with their permissions' })
  async findAll(): Promise<{ success: true; data: Role[] }> {
    const data = await this.rolesService.findAll();
    return { success: true, data };
  }

  @Post('roles')
  @RequirePermissions('manage_roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role (requires manage_roles)' })
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: JwtPayload,
    @UserPermissions() permissions: string[],
  ): Promise<{ success: true; data: Role }> {
    const effective = await this.rolesService.getEffectivePermissions(user);
    const data = await this.rolesService.create(
      dto,
      permissions,
      effective.roleKey,
    );
    return { success: true, data };
  }

  @Patch('roles/:id')
  @RequirePermissions('manage_roles')
  @ApiOperation({
    summary:
      'Update a role name, description or permissions (requires manage_roles)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
    @UserPermissions() permissions: string[],
  ): Promise<{ success: true; data: Role }> {
    const effective = await this.rolesService.getEffectivePermissions(user);
    const data = await this.rolesService.update(
      id,
      dto,
      permissions,
      effective,
    );
    return { success: true, data };
  }

  @Delete('roles/:id')
  @RequirePermissions('manage_roles')
  @ApiOperation({ summary: 'Delete a non-system role (requires manage_roles)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: true; data: null }> {
    await this.rolesService.remove(id, user.roleId);
    return { success: true, data: null };
  }
}
