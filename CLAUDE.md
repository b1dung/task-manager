# CRM ComCom — Claude Context

## Stack

| Layer | Tech |
|---|---|
| Backend | NestJS + TypeORM + PostgreSQL + Redis |
| Frontend | React 19 + TypeScript 6 + Vite + Tailwind CSS v4 |
| Shared | `@taskboard/shared` package (enums, types) |
| Auth | JWT access (15m) + refresh token rotation (7d) in DB |
| Realtime | Socket.IO (websocket module) |
| File uploads | multer → `./uploads/` served as static files |

## Monorepo structure

```
crm-comcom/
├── backend/          NestJS API (port 3000)
├── frontend/         React + Vite (port 5173)
├── shared/           Shared enums/types — must `npm run build` after editing
├── docker-compose.yml
└── CLAUDE.md
```

## Dev startup

```bash
# Services (Postgres + Redis) — run once
docker compose up postgres redis -d

# Backend (in tmux or separate terminal in WSL)
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev
```

Postgres runs in Docker: `docker exec taskboard_postgres psql -U taskboard -d taskboard -c "SQL"`

## Environment (backend/.env)

```
DB_HOST=localhost  DB_PORT=5432  DB_USERNAME=taskboard  DB_PASSWORD=taskboard  DB_NAME=taskboard
JWT_ACCESS_EXPIRES_IN=15m   JWT_REFRESH_EXPIRES_IN=7d
```

## Seed credentials

> Domain is `@taskboard.dev` (NOT `@example.com`).

| Email | Password | Role |
|---|---|---|
| admin@taskboard.dev | password123 | admin |
| manager@taskboard.dev | password123 | manager |
| member@taskboard.dev | password123 | member |

## Frontend routes

```
/login  /register
/projects                              ProjectsPage
/projects/:projectId/tasks             BoardPage  ← main page (Board / DnD)
/projects/:projectId/summary           SummaryPage (KPIs, status donut, workload, recent activity)
/projects/:projectId/calendar          CalendarPage (Month/Week/Agenda, DnD reschedule)
/projects/:projectId/team
/projects/:projectId/reports           ReportsPage (charts)
/projects/:projectId/developer-report  DeveloperReportPage (per-dev perf, productivity score)
/projects/:projectId/attachments       AttachmentsPage (all project files, grid, download/delete)
/projects/:projectId/notifications
/projects/:projectId/activity          ActivityPage (filter UI mirrors DeveloperReport)
/account                               AccountPage (avatar + profile)
```

URL param: `?selectedIssue={taskId}` → auto-opens TaskDetailModal on load.

Sidebar nav is grouped by function in `layout/Sidebar.tsx` (`NAV_GROUPS`): **Overview** (Summary) · **Work** (Board, Calendar, Attachments) · **Insights** (Reports, Dev Report) · **Collaboration** (Team, Notifications, Activity).

> **Naming**: "Kanban" was renamed to **Board** everywhere — `BoardPage`, `BoardFilters`, `pages/board/`, store key `board` + `setBoardFilter`/`clearBoardFilters`. The column component is `BoardColumnView` (NOT `BoardColumn` — that name is the column data type in `api/columns.ts`).

## Key frontend files

```
src/
├── api/
│   ├── client.ts          axios instance + JWT interceptor + refresh rotation
│   ├── tasks.ts           Task type, tasksApi
│   ├── reports.ts         reportsApi: summary, developerReport, weekly/monthly/etc.
│   ├── attachments.ts     task upload (w/ onProgress) + listForProject (project-wide)
│   └── users.ts           update profile, uploadAvatar
├── stores/
│   ├── useAuthStore.ts    user + tokens (persisted), setAuth/setTokens/setUser/logout
│   ├── useFilterStore.ts  board (BoardFilters), reports, activity filters
│   ├── useTaskStore.ts    optimistic task cache
│   └── useUIStore.ts      theme
├── components/ui/
│   └── TaskIcons.tsx      <TaskIcon> / <SubtaskIcon> inline SVG, color = text-accent (theme-aware)
├── pages/board/
│   ├── BoardPage.tsx     DnD board, AddTaskModal, URL param logic, projectKey derivation
│   └── components/
│       ├── TaskCard.tsx           card + subtask rows, PRIORITY_ICON map
│       ├── TaskDetailModal.tsx    detail modal: DescriptionEditor (Tiptap) + file attach w/ progress,
│       │                          AttachmentsSection (below Linked items), LinkedItemsSection
│       ├── BoardColumnView.tsx    droppable column (component; data type = BoardColumn in api/columns.ts)
│       ├── CommentThread.tsx      comments w/ edit/delete dropdown
│       └── FilterBar.tsx          search + Filter modal (portal, centered)
├── pages/summary/SummaryPage.tsx          dashboard (KPIs, donut, workload, recent activity)
├── pages/reports/DeveloperReportPage.tsx  per-dev performance + productivity score + CSV/PDF export
├── pages/attachments/AttachmentsPage.tsx  project-wide files grid (download/delete)
└── pages/account/AccountPage.tsx          avatar upload + profile edit
```

Test setup (`src/test/setup.ts`) stubs `document.elementFromPoint` + `Range.getClientRects/getBoundingClientRect` (jsdom lacks them; ProseMirror/Tiptap need them).

## Task ID format

`{projectKey}-{taskNumber}` — projectKey derived from project name:
- Multi-word: initials (e.g. "Task Board" → "TB")
- Single-word: first 5 chars uppercased (e.g. "design" → "DESIG")

```ts
function getProjectKey(name: string): string {
  const words = name.trim().split(/\s+/)
  return words.length > 1
    ? words.map(w => w[0]).join('').toUpperCase()
    : name.slice(0, 5).toUpperCase()
}
```

## Priority levels (5 total)

| Value | Icon | Label |
|---|---|---|
| `urgent` | `/priority/highest_new.svg` | Urgent |
| `high` | `/priority/high_new.svg` | High |
| `medium` | `/priority/medium_new.svg` | Medium |
| `low` | `/priority/low_new.svg` | Low |
| `lowest` | `/priority/lowest_new.svg` | Lowest |

DB enum: `tasks_priority_enum` in PostgreSQL.

## Auth flow (token rotation)

1. Login → `accessToken` (15m) + `refreshToken` (7d) stored in Zustand persist
2. Request interceptor attaches `Authorization: Bearer {accessToken}`
3. On 401: interceptor calls `POST /auth/refresh` with old refreshToken
4. Backend **revokes old refreshToken**, issues NEW pair
5. Frontend saves **both** new tokens via `setTokens(accessToken, newRefreshToken)`
6. If refresh fails → `logout()` → redirect to /login
7. Session lasts indefinitely while active; expires after 7 days idle

## File uploads

- **Avatar**: `PATCH /users/:id/avatar` → saved to `./uploads/avatars/`
- **Description images**: `POST /projects/:pid/tasks/:tid/attachments` → saved to `./uploads/attachments/`
- Vite proxy: `/uploads → http://localhost:3000` (in `vite.config.ts`)
- **Must** set `Content-Type: undefined` in axios call to let browser set multipart boundary

## Description editor (Tiptap)

Rich text stored as HTML in `tasks.description` (PostgreSQL `text` column).
Extensions: StarterKit, Underline, TextAlign, Image, Link, Placeholder, Highlight.
Image upload → attachments endpoint → insert `fileUrl` as `<img>` node.

## Shared package — ALWAYS rebuild after editing enums

```bash
cd shared && npm run build
```

Then restart backend (it imports from `@shared/enums`).

## TypeORM patterns

- Use `repository.update(id, dto)` — **never** `findById + save()` for partial updates
- Reason: `save()` with `select: false` fields (e.g. `passwordHash`) sets them to `null` → DB NOT NULL violation
- Add enum values: `ALTER TYPE {table}_{col}_enum ADD VALUE IF NOT EXISTS 'value';`

## CSS / Theming

Tailwind CSS v4. CSS variables in `src/index.css`:
- `--color-accent`, `--color-fg`, `--color-bg`, `--color-border`, etc.
- Themes: `dark` (default), `mint`, `light` — toggled via class on `<html>`
- `text-xs` overridden globally to `13px` in `tailwind.config.ts`

SVG icons with `fill="currentColor"` pick up theme color via `text-accent` class.

## Portal pattern (dropdowns / modals)

Use `createPortal(..., document.body)` for anything that needs z-index safety.
Use ternary `{condition ? createPortal(...) : null}` — **not** `{condition && createPortal(...)}` to avoid React 19 type errors.

## Common gotchas

1. **Shared enums**: edit `shared/src/enums.ts` → `npm run build` → restart backend
2. **DB enum**: must run `ALTER TYPE` SQL manually (no migration runner)
3. **Avatar URL**: stored as `/uploads/avatars/...` (relative), served via Vite proxy in dev
4. **FormData upload**: set `headers: { 'Content-Type': undefined }` to override axios default `application/json`
5. **React 19 + TS6**: use `import React from 'react'` + `React.ReactNode` instead of named import to avoid JSX type assignability errors
6. **tmux for backend**: backend runs in tmux session in WSL — use `tmux attach` to see logs
