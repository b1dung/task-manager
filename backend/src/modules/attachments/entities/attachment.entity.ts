import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({ name: 'uploader_id' })
  uploaderId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'uploader_id' })
  uploader!: User;

  @Column({ name: 'file_name' })
  fileName!: string;

  @Column({ name: 'file_url' })
  fileUrl!: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: number;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
