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
    await this.userRepository.update(id, { avatarUrl });
    return this.findById(id);
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
}
