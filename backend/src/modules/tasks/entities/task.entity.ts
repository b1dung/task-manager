import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { Label } from '@/modules/labels/entities/label.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { Sprint } from '@/modules/sprints/entities/sprint.entity';
import { User } from '@/modules/users/entities/user.entity';
import { TaskPriority, TaskStatus, TaskType } from '@shared/enums';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tasks')
@Index(['projectId', 'status'])
@Index(['columnId', 'position'])
@Index('idx_tasks_parent', ['parentTaskId'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ name: 'column_id' })
  columnId!: string;

  @ManyToOne(() => BoardColumn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'column_id' })
  column!: BoardColumn;

  @Column({ name: 'sprint_id', nullable: true, type: 'uuid' })
  sprintId!: string | null;

  @ManyToOne(() => Sprint, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sprint_id' })
  sprint!: Sprint | null;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: TaskType, default: TaskType.TASK })
  type!: TaskType;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee!: User | null;

  @Column({ name: 'reporter_id' })
  reporterId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({
    name: 'estimated_hours',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  estimatedHours!: number | null;

  @Column({
    name: 'logged_hours',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    default: 0,
  })
  loggedHours!: number | null;

  @Column({ name: 'story_points', type: 'int', nullable: true })
  storyPoints!: number | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId!: string | null;

  @ManyToOne(() => Task, (task) => task.subtasks, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask!: Task | null;

  @OneToMany(() => Task, (task) => task.parentTask)
  subtasks!: Task[];

  @Column({ name: 'task_number', type: 'int', nullable: true })
  taskNumber!: number | null;

  // Virtual fields — populated in service, not stored
  subtaskCount?: number;
  doneSubtaskCount?: number;
  subtasksPreview?: Task[];

  @ManyToMany(() => Label)
  @JoinTable({
    name: 'task_labels',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'label_id', referencedColumnName: 'id' },
  })
  labels!: Label[];

  /** When set, the task is archived: hidden from the board but kept intact. */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'archived_by', type: 'uuid', nullable: true })
  archivedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
