import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

jest.setTimeout(60000);

describe('Comments / Attachments / Activity (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const ownerEmail = `e2e-caa-owner-${Date.now()}@taskboard.dev`;
  const memberEmail = `e2e-caa-member-${Date.now()}@taskboard.dev`;
  const outsiderEmail = `e2e-caa-outsider-${Date.now()}@taskboard.dev`;
  const password = 'StrongPass123';

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let ownerUserId: string;
  let memberUserId: string;

  let projectId: string;
  let columnId: string;
  let taskId: string;
  let commentId: string;
  let replyId: string;
  let attachmentId: string;

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

  // Public registration now yields a *pending* account with no tokens; activate
  // it (and set its legacy role) directly, then log in.
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

    const owner = await registerAndLogin(ownerEmail, 'CAA Owner', 'admin');
    ownerToken = owner.token;
    ownerUserId = owner.userId;

    const member = await registerAndLogin(memberEmail, 'CAA Member');
    memberToken = member.token;
    memberUserId = member.userId;

    const outsider = await registerAndLogin(outsiderEmail, 'CAA Outsider');
    outsiderToken = outsider.token;

    const projectRes = await post('/api/v1/projects', ownerToken)
      .send({ name: `CAA Project ${Date.now()}` })
      .expect(201);
    projectId = projectRes.body.data.id;

    const columnsRes = await get(
      `/api/v1/projects/${projectId}/columns`,
      ownerToken,
    ).expect(200);
    columnId = columnsRes.body.data.sort(
      (a: { position: number }, b: { position: number }) =>
        a.position - b.position,
    )[0].id;

    await post(`/api/v1/projects/${projectId}/members`, ownerToken)
      .send({ userId: memberUserId, role: 'member' })
      .expect(201);

    const taskRes = await post(
      `/api/v1/projects/${projectId}/tasks`,
      ownerToken,
    )
      .send({ title: 'Task with comments', columnId })
      .expect(201);
    taskId = taskRes.body.data.id;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 60000);

  describe('Comments', () => {
    it('rejects an outsider from listing comments', async () => {
      await get(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        outsiderToken,
      ).expect(403);
    });

    it('creates a top-level comment with a mention', async () => {
      const res = await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        ownerToken,
      )
        .send({
          content: 'Hi @member, please take a look',
          mentionedUserIds: [memberUserId],
        })
        .expect(201);

      commentId = res.body.data.id;
      expect(res.body.data.content).toContain('please take a look');
      expect(res.body.data.authorId).toBe(ownerUserId);
    });

    it('rejects mentioning a user who is not a project member', async () => {
      await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        ownerToken,
      )
        .send({
          content: 'Hello stranger',
          mentionedUserIds: ['11111111-1111-4111-8111-111111111111'],
        })
        .expect(400);
    });

    it('creates a threaded reply', async () => {
      const res = await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        memberToken,
      )
        .send({ content: 'On it!', parentId: commentId })
        .expect(201);

      replyId = res.body.data.id;
      expect(res.body.data.parentId).toBe(commentId);
    });

    it('rejects a reply whose parent does not belong to the task', async () => {
      await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        memberToken,
      )
        .send({
          content: 'Bad reply',
          parentId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(400);
    });

    it('lists comments for the task in chronological order', async () => {
      const res = await get(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        memberToken,
      ).expect(200);
      const ids = res.body.data.map((c: { id: string }) => c.id);
      expect(ids.indexOf(commentId)).toBeLessThan(ids.indexOf(replyId));
    });

    it('rejects editing someone else’s comment', async () => {
      await patch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        memberToken,
      )
        .send({ content: 'hijacked' })
        .expect(403);
    });

    it('lets the author edit their own comment', async () => {
      const res = await patch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        ownerToken,
      )
        .send({ content: 'Hi @member, updated message' })
        .expect(200);

      expect(res.body.data.content).toBe('Hi @member, updated message');
      expect(res.body.data.editedAt).toEqual(expect.any(String));
    });

    it('rejects deleting someone else’s comment', async () => {
      await del(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        memberToken,
      ).expect(403);
    });

    it('lets the author delete their own comment', async () => {
      await del(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${replyId}`,
        memberToken,
      ).expect(200);

      const res = await get(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        memberToken,
      ).expect(200);
      expect(res.body.data.map((c: { id: string }) => c.id)).not.toContain(
        replyId,
      );
    });
  });

  describe('Attachments', () => {
    it('rejects an upload without a file', async () => {
      await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments`,
        ownerToken,
      ).expect(400);
    });

    it('uploads a file attachment', async () => {
      const res = await post(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments`,
        ownerToken,
      )
        .attach('file', Buffer.from('hello world'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      attachmentId = res.body.data.id;
      expect(res.body.data.fileName).toBe('notes.txt');
      expect(res.body.data.fileUrl).toMatch(/^\/uploads\/attachments\//);
      expect(res.body.data.uploaderId).toBe(ownerUserId);
    });

    it('lists attachments for the task', async () => {
      const res = await get(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments`,
        memberToken,
      ).expect(200);
      expect(res.body.data.map((a: { id: string }) => a.id)).toContain(
        attachmentId,
      );
    });

    it('rejects removing an attachment uploaded by someone else', async () => {
      await del(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
        memberToken,
      ).expect(403);
    });

    it('lets the uploader remove their own attachment', async () => {
      await del(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
        ownerToken,
      ).expect(200);

      const res = await get(
        `/api/v1/projects/${projectId}/tasks/${taskId}/attachments`,
        ownerToken,
      ).expect(200);
      expect(res.body.data.map((a: { id: string }) => a.id)).not.toContain(
        attachmentId,
      );
    });
  });

  describe('Activity', () => {
    it('rejects an outsider from viewing the activity log', async () => {
      await get(`/api/v1/projects/${projectId}/activity`, outsiderToken).expect(
        403,
      );
    });

    it('auto-logs task creation, comments, and updates for project members', async () => {
      await patch(`/api/v1/projects/${projectId}/tasks/${taskId}`, ownerToken)
        .send({ title: 'Task with comments (renamed)' })
        .expect(200);

      const res = await get(
        `/api/v1/projects/${projectId}/activity`,
        ownerToken,
      ).expect(200);
      const actions = res.body.data.map(
        (entry: { action: string; entityType: string }) => ({
          action: entry.action,
          entityType: entry.entityType,
        }),
      );

      expect(actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'created', entityType: 'task' }),
          expect.objectContaining({
            action: 'commented',
            entityType: 'comment',
          }),
          expect.objectContaining({ action: 'updated', entityType: 'task' }),
        ]),
      );
    });

    it('filters the activity log by entityType', async () => {
      const res = await get(
        `/api/v1/projects/${projectId}/activity?entityType=comment`,
        ownerToken,
      ).expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every(
          (entry: { entityType: string }) => entry.entityType === 'comment',
        ),
      ).toBe(true);
    });
  });
});
