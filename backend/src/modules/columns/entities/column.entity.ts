import { Project } from '@/modules/projects/entities/project.entity';
import {
  Column as TypeOrmColumn,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('columns')
export class BoardColumn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @TypeOrmColumn({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @TypeOrmColumn()
  name!: string;

  @TypeOrmColumn({ type: 'int', default: 0 })
  position!: number;

  @TypeOrmColumn({ type: 'varchar', nullable: true })
  color!: string | null;

  @TypeOrmColumn({ name: 'wip_limit', type: 'int', nullable: true })
  wipLimit!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
