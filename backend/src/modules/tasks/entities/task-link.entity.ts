import { Task } from '@/modules/tasks/entities/task.entity';
import { TaskLinkType } from '@shared/enums';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('task_links')
export class TaskLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_task_id' })
  sourceTaskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_task_id' })
  sourceTask!: Task;

  @Column({ name: 'target_task_id' })
  targetTaskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_task_id' })
  targetTask!: Task;

  @Column({ name: 'link_type', type: 'enum', enum: TaskLinkType })
  linkType!: TaskLinkType;
}
