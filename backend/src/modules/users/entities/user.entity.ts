import { UserRole } from '@shared/enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ name: 'avatar_url', nullable: true, type: 'varchar' })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  language!: 'vi' | 'en' | 'ja';

  @Column({ type: 'varchar', length: 16, default: 'midnight' })
  appearance!: 'light' | 'midnight' | 'mint';

  @Column({ type: 'varchar', length: 64, default: 'Asia/Ho_Chi_Minh' })
  timezone!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role!: UserRole;

  /** Optional assignment to a dynamic role (roles table). When set, it drives
   * the user's effective permissions; otherwise the legacy `role` enum is used. */
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled!: boolean;

  @Column({
    name: 'two_factor_secret',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  twoFactorSecret!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
