import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { TaskPriority, TaskStatus, TaskType, UserRole } from '@shared/enums';
import { AppDataSource } from '@/database/data-source';
import { User } from '@/modules/users/entities/user.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { ProjectMember } from '@/modules/members/entities/project-member.entity';
import { BoardColumn } from '@/modules/columns/entities/column.entity';
import { Task } from '@/modules/tasks/entities/task.entity';

async function seed(): Promise<void> {
  const dataSource = await AppDataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const projectRepo = dataSource.getRepository(Project);
  const memberRepo = dataSource.getRepository(ProjectMember);
  const columnRepo = dataSource.getRepository(BoardColumn);
  const taskRepo = dataSource.getRepository(Task);

  console.log('Seeding: clearing existing data...');
  await taskRepo.query(
    'TRUNCATE TABLE tasks, columns, project_members, projects, users RESTART IDENTITY CASCADE',
  );

  console.log('Seeding: users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const [admin, manager, member] = await userRepo.save([
    userRepo.create({
      email: 'admin@taskboard.dev',
      passwordHash,
      fullName: 'Alice Admin',
      role: UserRole.ADMIN,
      avatarUrl: null,
    }),
    userRepo.create({
      email: 'manager@taskboard.dev',
      passwordHash,
      fullName: 'Bob Manager',
      role: UserRole.MANAGER,
      avatarUrl: null,
    }),
    userRepo.create({
      email: 'member@taskboard.dev',
      passwordHash,
      fullName: 'Carol Member',
      role: UserRole.MEMBER,
      avatarUrl: null,
    }),
  ]);

  console.log('Seeding: project...');
  const project = await projectRepo.save(
    projectRepo.create({
      name: 'TaskBoard Demo',
      slug: 'taskboard-demo',
      description: 'Demo project seeded for local development',
      ownerId: admin.id,
      settingsJson: null,
    }),
  );

  await memberRepo.save([
    memberRepo.create({
      projectId: project.id,
      userId: admin.id,
      role: UserRole.ADMIN,
    }),
    memberRepo.create({
      projectId: project.id,
      userId: manager.id,
      role: UserRole.MANAGER,
    }),
    memberRepo.create({
      projectId: project.id,
      userId: member.id,
      role: UserRole.MEMBER,
    }),
  ]);

  console.log('Seeding: columns...');
  const columnDefs = [
    { name: 'Todo', position: 0, color: '#7c7c8c' },
    { name: 'In Progress', position: 1, color: '#569cff' },
    { name: 'In Review', position: 2, color: '#f0b138' },
    { name: 'Done', position: 3, color: '#34c77b' },
  ];
  const columns = await columnRepo.save(
    columnDefs.map((c) =>
      columnRepo.create({
        projectId: project.id,
        name: c.name,
        position: c.position,
        color: c.color,
        wipLimit: null,
      }),
    ),
  );

  console.log('Seeding: tasks...');
  const taskDefs: Array<{
    title: string;
    type: TaskType;
    priority: TaskPriority;
    status: TaskStatus;
    columnIndex: number;
    assigneeId: string | null;
  }> = [
    {
      title: 'Setup CI pipeline',
      type: TaskType.TASK,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      columnIndex: 0,
      assigneeId: admin.id,
    },
    {
      title: 'Design login page',
      type: TaskType.FEATURE,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      columnIndex: 0,
      assigneeId: member.id,
    },
    {
      title: 'Fix avatar upload bug',
      type: TaskType.BUG,
      priority: TaskPriority.URGENT,
      status: TaskStatus.TODO,
      columnIndex: 0,
      assigneeId: manager.id,
    },
    {
      title: 'Implement Board drag & drop',
      type: TaskType.FEATURE,
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      columnIndex: 1,
      assigneeId: member.id,
    },
    {
      title: 'Build notifications service',
      type: TaskType.STORY,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      columnIndex: 1,
      assigneeId: manager.id,
    },
    {
      title: 'Write API documentation',
      type: TaskType.TASK,
      priority: TaskPriority.LOW,
      status: TaskStatus.IN_PROGRESS,
      columnIndex: 1,
      assigneeId: admin.id,
    },
    {
      title: 'Refactor task service',
      type: TaskType.TASK,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      columnIndex: 2,
      assigneeId: member.id,
    },
    {
      title: 'Add report charts',
      type: TaskType.FEATURE,
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_REVIEW,
      columnIndex: 2,
      assigneeId: manager.id,
    },
    {
      title: 'Database schema review',
      type: TaskType.EPIC,
      priority: TaskPriority.LOW,
      status: TaskStatus.DONE,
      columnIndex: 3,
      assigneeId: admin.id,
    },
    {
      title: 'Project kickoff meeting',
      type: TaskType.TASK,
      priority: TaskPriority.LOW,
      status: TaskStatus.DONE,
      columnIndex: 3,
      assigneeId: manager.id,
    },
  ];

  await taskRepo.save(
    taskDefs.map((t, index) =>
      taskRepo.create({
        projectId: project.id,
        columnId: columns[t.columnIndex].id,
        sprintId: null,
        title: t.title,
        description: `Seed description for "${t.title}"`,
        type: t.type,
        priority: t.priority,
        status: t.status,
        assigneeId: t.assigneeId,
        reporterId: admin.id,
        dueDate: null,
        estimatedHours: 8,
        loggedHours: 0,
        storyPoints: 3,
        position: index,
        parentTaskId: null,
      }),
    ),
  );

  console.log('Seed completed: 3 users, 1 project, 4 columns, 10 tasks.');
  await dataSource.destroy();
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
