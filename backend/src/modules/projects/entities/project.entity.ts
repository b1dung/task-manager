import { User } from '@/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @Column({ name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'settings_json', type: 'jsonb', nullable: true })
  settingsJson!: Record<string, unknown> | null;

  /** When set, the project is archived: hidden from normal lists but kept intact. */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'archived_by', type: 'uuid', nullable: true })
  archivedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Soft delete — `repository.softRemove` sets this; data is retained. */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  // Non-persisted, populated in the management view.
  taskCount?: number;
  memberCount?: number;
}
