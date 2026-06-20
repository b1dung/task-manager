import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@shared/enums';
import { JwtPayload } from '@/modules/auth/interfaces/jwt-payload.interface';
import { Role } from '@/modules/roles/entities/role.entity';
import { CreateRoleDto } from '@/modules/roles/dto/create-role.dto';
import { UpdateRoleDto } from '@/modules/roles/dto/update-role.dto';
import {
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
  PermissionDef,
} from '@/modules/roles/permissions.catalog';

/** Maps the legacy `users.role` enum to a default dynamic-role key, used when a
 * user has not been assigned a dynamic role yet (roleId is null). */
const LEGACY_ROLE_MAP: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'admin',
  [UserRole.MANAGER]: 'pm',
  [UserRole.MEMBER]: 'member',
  [UserRole.VIEWER]: 'client',
};

export interface EffectivePermissions {
  roleId: string | null;
  roleKey: string | null;
  permissions: string[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  // Small in-memory cache of roles for fast per-request permission resolution.
  private byId = new Map<string, Role>();
  private byKey = new Map<string, Role>();
  private loaded = false;

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  private invalidateCache(): void {
    this.loaded = false;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const all = await this.roleRepository.find();
    this.byId = new Map(all.map((r) => [r.id, r]));
    this.byKey = new Map(all.map((r) => [r.key, r]));
    this.loaded = true;
  }

  /** Resolve the effective permission keys for a JWT user. */
  async resolvePermissions(
    payload: Pick<JwtPayload, 'role' | 'roleId'>,
  ): Promise<string[]> {
    return (await this.getEffectivePermissions(payload)).permissions;
  }

  async getEffectivePermissions(
    payload: Pick<JwtPayload, 'role' | 'roleId'>,
  ): Promise<EffectivePermissions> {
    await this.ensureLoaded();

    if (payload.roleId) {
      const role = this.byId.get(payload.roleId);
      if (role) {
        return {
          roleId: role.id,
          roleKey: role.key,
          permissions: role.permissions,
        };
      }
    }

    const key = LEGACY_ROLE_MAP[payload.role] ?? 'member';
    const role = this.byKey.get(key);
    return {
      roleId: role?.id ?? null,
      roleKey: role?.key ?? null,
      permissions: role?.permissions ?? [],
    };
  }

  /** Seed the default workspace roles once, if none exist yet. */
  async onModuleInit(): Promise<void> {
    try {
      const count = await this.roleRepository.count();
      if (count > 0) return;
      await this.roleRepository.save(
        DEFAULT_ROLES.map((r) =>
          this.roleRepository.create({
            key: r.key,
            name: r.name,
            description: r.description,
            isSystem: true,
            permissions: r.permissions,
            sortOrder: r.sortOrder,
          }),
        ),
      );
      this.invalidateCache();
      this.logger.log(`Seeded ${DEFAULT_ROLES.length} default roles`);
    } catch (err) {
      // Table may not exist yet on a fresh DB — log and continue.
      this.logger.warn(
        `Skipped default role seeding: ${(err as Error).message}`,
      );
    }
  }

  getPermissionCatalog(): PermissionDef[] {
    return PERMISSION_CATALOG;
  }

  findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const key = slugify(dto.name);
    if (!key) {
      throw new BadRequestException('Invalid role name');
    }
    const existing = await this.roleRepository.findOne({ where: { key } });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }
    const max = await this.roleRepository
      .createQueryBuilder('r')
      .select('MAX(r.sort_order)', 'max')
      .getRawOne<{ max: number | null }>();

    const role = this.roleRepository.create({
      key,
      name: dto.name,
      description: dto.description ?? null,
      isSystem: false,
      permissions: dto.permissions ?? [],
      sortOrder: (max?.max ?? 0) + 1,
    });
    const saved = await this.roleRepository.save(role);
    this.invalidateCache();
    return saved;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    // System roles keep their identity (name/key) but permissions stay editable.
    if (role.isSystem && dto.name !== undefined && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename a system role');
    }

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissions !== undefined) role.permissions = dto.permissions;

    const saved = await this.roleRepository.save(role);
    this.invalidateCache();
    return saved;
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete a system role');
    }
    await this.roleRepository.delete(id);
    this.invalidateCache();
  }
}
