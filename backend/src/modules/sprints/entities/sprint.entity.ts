import { Project } from '@/modules/projects/entities/project.entity';
import { SprintStatus } from '@shared/enums';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sprints')
export class Sprint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  goal!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'enum', enum: SprintStatus, default: SprintStatus.PLANNED })
  status!: SprintStatus;
}
