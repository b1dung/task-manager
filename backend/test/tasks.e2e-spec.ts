import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(60000);

describe('Projects / Boards / Tasks (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const ownerEmail = `e2e-owner-${Date.now()}@taskboard.dev`;
  const memberEmail = `e2e-member-${Date.now()}@taskboard.dev`;
  const outsiderEmail = `e2e-outsider-${Date.now()}@taskboard.dev`;
  const password = 'StrongPass123';

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let memberUserId: string;

  let projectId: string;
  let columnIds: string[] = [];
  let extraColumnId: string;
  let labelId: string;
  let sprintId: string;
  let taskAId: string;
  let taskBId: string;
  let linkId: string;

  const post = (path: string, token?: string) => {
    const req = request(server).post(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const get = (path: string, token?: string) => {
    const req = request(server).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const patch = (path: string, token?: string) => {
    const req = request(server).patch(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const del = (path: string, token?: string) => {
    const req = request(server).delete(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  // Public registration now creates a *pending* (inactive) account with no
  // tokens. For tests we activate it (and set its legacy role) directly, then log in.
  async function registerAndLogin(
    email: string,
    fullName: string,
    role: 'admin' | 'manager' | 'member' = 'member',
  ): Promise<{ token: string; userId: string }> {
    const reg = await post('/api/v1/auth/register')
      .send({ email, password, fullName })
      .expect(201);
    const userId = reg.body.data.user.id as string;
    await app
      .get(DataSource)
      .query(`UPDATE users SET is_active = true, role = $2 WHERE id = $1`, [
        userId,
        role,
      ]);
    const login = await post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    return { token: login.body.data.accessToken as string, userId };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();

    // Owner is elevated to admin so it holds `create_project`.
    const owner = await registerAndLogin(ownerEmail, 'E2E Owner', 'admin');
    ownerToken = owner.token;

    const member = await registerAndLogin(memberEmail, 'E2E Member');
    memberToken = member.token;
    memberUserId = member.userId;

    const outsider = await registerAndLogin(outsiderEmail, 'E2E Outsider');
    outsiderToken = outsider.token;
  }, 60000);

  afterAll(async () => {
    if (app) {
      try {
        const ds = app.get(DataSource);
        const emails = [ownerEmail, memberEmail, outsiderEmail];
        await ds.query(
          'DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE email = ANY($1))',
          [emails],
        );
        await ds.query(
          'DELETE FROM activity_logs WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))',
          [emails],
        );
        await ds.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
      } catch {
        /* best-effort cleanup */
      }
      await app.close();
    }
  }, 60000);

  it('POST /api/v1/projects creates a project with default columns and an admin membership', async () => {
    const res = await post('/api/v1/projects', ownerToken)
      .send({ name: `E2E Project ${Date.now()}` })
      .expect(201);

    expect(res.body.success).toBe(true);
    projectId = res.body.data.id;
    expect(res.body.data.slug).toEqual(expect.any(String));

    const columnsRes = await get(
      `/api/v1/projects/${projectId}/columns`,
      ownerToken,
    ).expect(200);
    expect(columnsRes.body.data).toHaveLength(4);
    expect(columnsRes.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ]);
    columnIds = columnsRes.body.data
      .sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      )
      .map((c: { id: string }) => c.id);
  });

  it('rejects project creation for a user lacking create_project (self-registered member)', async () => {
    await post('/api/v1/projects', memberToken)
      .send({ name: 'Should Be Forbidden' })
      .expect(403);
  });

  it('GET /api/v1/projects lists projects for the authenticated user', async () => {
    const res = await get('/api/v1/projects', ownerToken).expect(200);
    expect(res.body.data.some((p: { id: string }) => p.id === projectId)).toBe(
      true,
    );
  });

  it('rejects access from a user who is not a project member', async () => {
    await get(`/api/v1/projects/${projectId}/columns`, outsiderToken).expect(
      403,
    );
    await get(`/api/v1/projects/${projectId}/tasks`, outsiderToken).expect(403);
  });

  it('POST /api/v1/projects/:projectId/members adds a member to the project', async () => {
    const res = await post(`/api/v1/projects/${projectId}/members`, ownerToken)
      .send({ userId: memberUserId, role: 'member' })
      .expect(201);

    expect(res.body.data.userId).toBe(memberUserId);
    expect(res.body.data.role).toBe('member');
  });

  it('rejects adding the same member twice', async () => {
    await post(`/api/v1/projects/${projectId}/members`, ownerToken)
      .send({ userId: memberUserId, role: 'member' })
      .expect(409);
  });

  it('member can now access the project board', async () => {
    const res = await get(
      `/api/v1/projects/${projectId}/columns`,
      memberToken,
    ).expect(200);
    expect(res.body.data).toHaveLength(4);
  });

  it('POST /api/v1/projects/:projectId/columns creates an extra column and reorder moves it', async () => {
    const createRes = await post(
      `/api/v1/projects/${projectId}/columns`,
      ownerToken,
    )
      .send({ name: 'Backlog' })
      .expect(201);
    extraColumnId = createRes.body.data.id;
    expect(createRes.body.data.position).toBe(4);

    const newOrder = [extraColumnId, ...columnIds];
    const reorderRes = await patch(
      `/api/v1/projects/${projectId}/columns/reorder`,
      ownerToken,
    )
      .send({ columnIds: newOrder })
      .expect(200);

    expect(reorderRes.body.data.map((c: { id: string }) => c.id)).toEqual(
      newOrder,
    );
  });

  it('POST /api/v1/projects/:projectId/labels creates a label', async () => {
    const res = await post(`/api/v1/projects/${projectId}/labels`, ownerToken)
      .send({ name: 'Bug', color: '#ff0000' })
      .expect(201);
    labelId = res.body.data.id;
    expect(res.body.data.color).toBe('#ff0000');
  });

  it('POST /api/v1/projects/:projectId/sprints creates a sprint', async () => {
    const res = await post(`/api/v1/projects/${projectId}/sprints`, ownerToken)
      .send({
        name: 'Sprint 1',
        goal: 'Ship the MVP',
        startDate: '2026-06-01',
        endDate: '2026-06-14',
      })
      .expect(201);
    sprintId = res.body.data.id;
    expect(res.body.data.name).toBe('Sprint 1');
  });

  it('POST /api/v1/projects/:projectId/tasks creates tasks in the first column', async () => {
    const resA = await post(`/api/v1/projects/${projectId}/tasks`, ownerToken)
      .send({
        title: 'Task A',
        columnId: columnIds[0],
        assigneeId: memberUserId,
        sprintId,
        labelIds: [labelId],
        priority: 'high',
        type: 'bug',
      })
      .expect(201);
    taskAId = resA.body.data.id;
    expect(resA.body.data.position).toBe(0);
    expect(resA.body.data.labels).toHaveLength(1);
    expect(resA.body.data.status).toBe('todo');

    const resB = await post(`/api/v1/projects/${projectId}/tasks`, ownerToken)
      .send({ title: 'Task B', columnId: columnIds[0] })
      .expect(201);
    taskBId = resB.body.data.id;
    expect(resB.body.data.position).toBe(1);
  });

  it('rejects creating a task with a column from another project', async () => {
    await post(`/api/v1/projects/${projectId}/tasks`, ownerToken)
      .send({
        title: 'Invalid task',
        columnId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(400);
  });

  it('GET /api/v1/projects/:projectId/tasks lists and filters tasks', async () => {
    const all = await get(
      `/api/v1/projects/${projectId}/tasks`,
      memberToken,
    ).expect(200);
    expect(all.body.data.map((t: { id: string }) => t.id)).toEqual(
      expect.arrayContaining([taskAId, taskBId]),
    );

    const filtered = await get(
      `/api/v1/projects/${projectId}/tasks?assigneeId=${memberUserId}&priority=high`,
      memberToken,
    ).expect(200);
    expect(filtered.body.data.map((t: { id: string }) => t.id)).toEqual([
      taskAId,
    ]);

    const searched = await get(
      `/api/v1/projects/${projectId}/tasks?search=Task B`,
      memberToken,
    ).expect(200);
    expect(searched.body.data.map((t: { id: string }) => t.id)).toEqual([
      taskBId,
    ]);
  });

  it('PATCH /api/v1/projects/:projectId/tasks/:id updates a task', async () => {
    const res = await patch(
      `/api/v1/projects/${projectId}/tasks/${taskAId}`,
      ownerToken,
    )
      .send({ status: 'in_progress', storyPoints: 5, loggedHours: 2 })
      .expect(200);

    expect(res.body.data.status).toBe('in_progress');
    expect(Number(res.body.data.storyPoints)).toBe(5);
  });

  it('rejects assigning a task to a user who is not a project member', async () => {
    await patch(`/api/v1/projects/${projectId}/tasks/${taskAId}`, ownerToken)
      .send({ assigneeId: '99999999-9999-4999-8999-999999999999' })
      .expect(400);
  });

  it('PATCH /api/v1/projects/:projectId/tasks/:id/move reorders within the same column', async () => {
    const res = await patch(
      `/api/v1/projects/${projectId}/tasks/${taskBId}/move`,
      ownerToken,
    )
      .send({ columnId: columnIds[0], position: 0 })
      .expect(200);

    expect(res.body.data.position).toBe(0);
    expect(res.body.data.columnId).toBe(columnIds[0]);

    const list = await get(
      `/api/v1/projects/${projectId}/tasks?status=todo`,
      ownerToken,
    ).expect(200);
    const ordered = list.body.data
      .filter((t: { columnId: string }) => t.columnId === columnIds[0])
      .sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position,
      );
    expect(ordered[0].id).toBe(taskBId);
  });

  it('PATCH /api/v1/projects/:projectId/tasks/:id/move moves a task to a different column', async () => {
    const res = await patch(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/move`,
      ownerToken,
    )
      .send({ columnId: columnIds[1], position: 0 })
      .expect(200);

    expect(res.body.data.columnId).toBe(columnIds[1]);
    expect(res.body.data.position).toBe(0);

    const remaining = await get(
      `/api/v1/projects/${projectId}/tasks/${taskBId}`,
      ownerToken,
    ).expect(200);
    expect(remaining.body.data.position).toBe(0);
    expect(remaining.body.data.columnId).toBe(columnIds[0]);
  });

  it('POST /api/v1/projects/:projectId/tasks/:id/links links two tasks', async () => {
    const res = await post(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links`,
      ownerToken,
    )
      .send({ targetTaskId: taskBId, linkType: 'blocks' })
      .expect(201);

    linkId = res.body.data.id;
    expect(res.body.data.sourceTaskId).toBe(taskAId);
    expect(res.body.data.targetTaskId).toBe(taskBId);
  });

  it('rejects a task linking to itself', async () => {
    await post(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links`,
      ownerToken,
    )
      .send({ targetTaskId: taskAId, linkType: 'relates_to' })
      .expect(400);
  });

  it('rejects a duplicate link', async () => {
    await post(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links`,
      ownerToken,
    )
      .send({ targetTaskId: taskBId, linkType: 'blocks' })
      .expect(409);
  });

  it('GET /api/v1/projects/:projectId/tasks/:id/links lists links for a task', async () => {
    const res = await get(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links`,
      memberToken,
    ).expect(200);
    expect(res.body.data.map((l: { id: string }) => l.id)).toContain(linkId);
  });

  it('DELETE /api/v1/projects/:projectId/tasks/:id/links/:linkId removes the link', async () => {
    await del(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links/${linkId}`,
      ownerToken,
    ).expect(200);

    const res = await get(
      `/api/v1/projects/${projectId}/tasks/${taskAId}/links`,
      ownerToken,
    ).expect(200);
    expect(res.body.data.map((l: { id: string }) => l.id)).not.toContain(
      linkId,
    );
  });

  it('DELETE /api/v1/projects/:projectId/tasks/:id soft-deletes a task', async () => {
    await del(
      `/api/v1/projects/${projectId}/tasks/${taskBId}`,
      ownerToken,
    ).expect(200);
    await get(
      `/api/v1/projects/${projectId}/tasks/${taskBId}`,
      ownerToken,
    ).expect(404);
  });

  it('PATCH /api/v1/projects/:projectId/members/:userId/role lets an admin change roles', async () => {
    const res = await patch(
      `/api/v1/projects/${projectId}/members/${memberUserId}`,
      ownerToken,
    )
      .send({ role: 'manager' })
      .expect(200);
    expect(res.body.data.role).toBe('manager');
  });

  it('rejects a non-admin from managing members', async () => {
    await post(`/api/v1/projects/${projectId}/members`, memberToken)
      .send({ userId: memberUserId, role: 'member' })
      .expect(403);
  });
});
