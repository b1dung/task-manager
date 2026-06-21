import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ILike, Not, Repository } from 'typeorm';
import { UserRole } from '@shared/enums';
import { User } from '@/modules/users/entities/user.entity';
import { CreateUserDto } from '@/modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { join } from 'path';
import { unlink } from 'fs/promises';

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  fullName: string;
  /** Defaults to true. Public self-registration creates pending (inactive) users. */
  isActive?: boolean;
  /** Optional dynamic role to assign (e.g. from an invite). */
  roleId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(params: CreateUserParams): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: params.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = this.userRepository.create({
      email: params.email,
      passwordHash: params.passwordHash,
      fullName: params.fullName,
      avatarUrl: null,
      isActive: params.isActive ?? true,
      roleId: params.roleId ?? null,
    });
    return this.userRepository.save(user);
  }

  async adminCreate(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role ?? UserRole.MEMBER,
      avatarUrl: null,
    });
    return this.userRepository.save(user);
  }

  async findAll(search?: string): Promise<User[]> {
    if (search) {
      return this.userRepository.find({
        where: [
          { fullName: ILike(`%${search}%`) },
          { email: ILike(`%${search}%`) },
        ],
        order: { fullName: 'ASC' },
      });
    }
    return this.userRepository.find({ order: { fullName: 'ASC' } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findActiveById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id, isActive: true } });
  }

  countActiveByRoleId(roleId: string): Promise<number> {
    return this.userRepository.count({ where: { roleId, isActive: true } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.email) {
      const conflict = await this.userRepository.findOne({
        where: { email: dto.email, id: Not(id) },
      });
      if (conflict) {
        throw new ConflictException('Email already registered');
      }
    }
    await this.userRepository.update(id, dto);
    return this.findById(id);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    const current = await this.findById(id);
    await this.userRepository.update(id, { avatarUrl });
    if (
      current.avatarUrl?.startsWith('/uploads/avatars/') &&
      current.avatarUrl !== avatarUrl
    ) {
      await unlink(
        join(process.cwd(), current.avatarUrl.replace(/^\//, '')),
      ).catch(() => undefined);
    }
    return this.findById(id);
  }

  /** Change a user's password after verifying their current one. */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(id, { passwordHash });
    await this.userRepository.manager.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [id],
    );
  }

  async setPassword(id: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, 12);
    await this.userRepository.update(id, { passwordHash });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userRepository.update(id, { emailVerifiedAt: new Date() });
  }

  findWithTwoFactorSecret(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setTwoFactor(
    id: string,
    secret: string | null,
    enabled: boolean,
  ): Promise<void> {
    await this.userRepository.update(id, {
      twoFactorSecret: secret,
      twoFactorEnabled: enabled,
    });
  }

  /**
   * Permanently delete a user. Projects they own are cascade-deleted (with all
   * their tasks/columns/etc.); tasks/attachments they touched elsewhere keep the
   * record with the author set to null. Admins cannot delete their own account.
   */
  async remove(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) {
      throw new BadRequestException(
        'Bạn không thể xóa tài khoản của chính mình',
      );
    }
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.manager.transaction(async (m) => {
      // Owned projects cascade to their columns/tasks/sprints/labels/members.
      await m.query('DELETE FROM projects WHERE owner_id = $1', [id]);
      // activity_logs.user_id is NOT NULL, so the FK's SET NULL action can't run.
      await m.query('DELETE FROM activity_logs WHERE user_id = $1', [id]);
      // Cascades memberships, refresh tokens, comments, notifications, working hours.
      await m.delete(User, id);
    });
  }

  async exportOwnData(id: string): Promise<Record<string, unknown>> {
    const profile = await this.findById(id);
    const manager = this.userRepository.manager;
    const [memberships, tasks, comments, activity] = await Promise.all([
      manager.query('SELECT * FROM project_members WHERE user_id = $1', [id]),
      manager.query(
        'SELECT * FROM tasks WHERE reporter_id = $1 OR assignee_id = $1 ORDER BY created_at DESC',
        [id],
      ),
      manager.query(
        'SELECT * FROM comments WHERE author_id = $1 ORDER BY created_at DESC',
        [id],
      ),
      manager.query(
        'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC',
        [id],
      ),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      memberships,
      tasks,
      comments,
      activity,
    };
  }

  async deleteOwnAccount(id: string, currentPassword: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    await this.userRepository.manager.transaction(async (manager) => {
      await manager.query('DELETE FROM projects WHERE owner_id = $1', [id]);
      await manager.query('DELETE FROM activity_logs WHERE user_id = $1', [id]);
      await manager.delete(User, id);
    });
  }
}
