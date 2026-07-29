# SeOrganizeB2B — Technical Architecture

> **Author:** Architect Agent  
> **Status:** Draft for discussion  
> **Date:** 2026-07-29  
> **Based on:** handoff-brief.md, handoff-product.md, handoff-design.md

---

## Table of Contents

1. [Tech Stack Finalization](#1-tech-stack-finalization)
2. [Module & Service Boundaries](#2-module--service-boundaries)
3. [Data Model / Schema](#3-data-model--schema)
4. [API Contracts](#4-api-contracts)
5. [File / Folder Structure](#5-file--folder-structure)
6. [Key Algorithm Decisions](#6-key-algorithm-decisions)
7. [Google Calendar Integration](#7-google-calendar-integration)
8. [.md Document Storage & Editor](#8-md-document-storage--editor)

---

## 1. Tech Stack Finalization

### Stack Decision Table

| Concern | Choice | Rationale | Trade-offs |
|---------|--------|-----------|------------|
| **Framework** | Next.js 14 (App Router) | Product spec says single Next.js app. App Router gives server components, RSC streaming, and nested layouts — the sidebar + topbar + content shell maps directly to `layout.tsx` nesting. | Pages Router is simpler for pure CRUD apps, but App Router is now stable and the long-term direction. Learning curve is shallow for this scope. |
| **Language** | TypeScript (strict) | Every handoff doc assumes it. Catches null/undefined bugs at compile time. |
| **Database** | Supabase (Postgres free tier) | 500 MB DB, 5 GB bandwidth, 50k monthly active users — far more than needed for a team of 5-7. Postgres accessed exclusively via Prisma, not PostgREST. | Free tier pauses if inactive for 7 days. Need a keep-alive cron (Vercel Cron + ping endpoint). |
| **ORM / DB client** | Prisma ORM | Founder preference. Prisma connects directly to Supabase Postgres via `DATABASE_URL`. Full type generation, migrations, and schema introspection. Supabase serves only as a Postgres host. | Cold start penalty on Vercel serverless (~500ms extra per invocation due to Prisma engine binary). Mitigation: use `@prisma/extension-accelerate` or deploy on Node/VPS if latency becomes an issue. |
| **Auth** | Supabase Auth (GoTrue API, client-side SDK) | `supabase.auth` SDK handles Google OAuth + Magic Link. Calls GoTrue API directly — no PostgREST involved. Session stored in cookies for server-side access. | Limited social providers on free tier — enough for Google. No SMS/phone. |
| **Real-time** | Supabase Realtime (WebSocket) | Built-in, zero infra. Listens to Postgres changes via replication. | Free tier: limited to 200 concurrent connections and 100k messages/day. Fine for a team of 5-7. |
| **State management** | TanStack Query (React Query) | Server-state cache, optimistic updates for drag-and-drop, background refetch for real-time. No client-state library needed. | Not a replacement for global UI state (theme, sidebar collapsed). Use React Context for those. |
| **Styling** | Tailwind CSS + shadcn/ui | Design tokens from handoff-design.md map directly to Tailwind classes. shadcn/ui provides accessible primitives (dialog, dropdown, popover, etc.) with zero config. | shadcn/ui components are copy-pasted, not a dependency. Adds ~500 KB to the repo. Worth it for design consistency. |
| **Kanban DnD** | `@dnd-kit/core` + `@dnd-kit/sortable` | Lightweight (12 KB), no paid tier, React-first, accessible. Used in production by many apps. | No built-in column management — must build column reorder and drag-between-columns logic. |
| **Calendar** | Full Calendar (`@fullcalendar/react`) or custom week grid | Full Calendar has day/week/month views, event rendering, and Google Calendar integration helpers. 30 KB gzip. | Full Calendar is free (MIT for core). Premium plugins not needed. |
| **MD Editor** | `@uiw/react-md-editor` (CodeMirror-based) | CodeMirror 6 based, lightweight, split preview, MIT license. Supports markdown shortcuts. | MDXEditor is heavier and still evolving. CodeMirror path is more stable. If custom shortcuts needed, easy to extend. |
| **Deployment** | Vercel (Hobby) | First-party Next.js hosting, zero ops, auto HTTPS, CI/CD from GitHub, 100 GB bandwidth free. | Cold starts on free tier (serverless function spin-up). Prisma adds extra cold start cost. Mitigation: static pages where possible, consider Node VPS if latency is a problem. |
| **Git provider** | GitHub (free) | Standard. Free for private repos with up to 3 collaborators. |
| **CI** | Vercel auto-deploy (GitHub integration) | No separate CI needed. Vercel builds on push. |
| **Analytics** | Vercel Analytics (free tier) | Lightweight, privacy-friendly. Track DAU/WAU per success metrics. | Basic — no session recordings. Use PostHog self-hosted later if needed. |
| **Error tracking** | Sentry (free tier) | 5k events/month free. Enough for a team of 5-7. | Would exceed if uncaught errors loop. Set sampling. |

### Why Not...

- **Next.js Pages Router:** App Router's layout nesting (sidebar + topbar persistent across routes) directly matches the wireframes. Pages Router would require manual layout composition.
- **VPS (DigitalOcean, Hetzner):** Adds ops burden (Docker, nginx, SSL renewal, backups) for zero benefit at this scale. Vercel abstracts all of that.
- **Drizzle:** Prisma chosen over Drizzle for mature migration system, better type generation, and broader ecosystem. Drizzle is lighter but Prisma's DX wins for this size team.
- **Zustand / Jotai / Redux:** All server-state. TanStack Query + React Context for UI state is sufficient. Adding a client-store library for a 5-person internal tool is over-engineering.
- **Pusher / Ably for real-time:** Supabase Realtime is built-in and free. No reason to add another service.
- **tRPC:** REST is simpler for this scope — one serverless function per endpoint. tRPC shines in large teams with strict type safety across the wire. For 5 endpoints, REST is clearer.

### Free Tier Budget

| Service | Free Tier Limit | Expected Usage (team of 7) | Headroom |
|---------|----------------|---------------------------|----------|
| Supabase DB | 500 MB | ~10 MB (text + structured data) | 98% |
| Supabase Auth | 50k MAU | 10 users | 99.9% |
| Supabase Realtime | 200 concurrent | 7-10 | 95% |
| Supabase Storage | 1 GB | 0 (docs stored as text in DB) | 100% |
| Vercel Hobby | 100 GB bandwidth | <1 GB | 99% |
| Vercel Hobby | 6k build mins | ~50/mo | 99% |
| Sentry | 5k events | ~500/mo | 90% |

**Conclusion:** Free tier headroom is excellent. No paid service needed for MVP.

---

## 2. Module & Service Boundaries

### Module Map

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Auth   │ │ Project  │ │  Tasks   │ │  Kanban  │  │
│  │ Module   │ │ Module   │ │ Module   │ │ Module   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │         │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐  │
│  │  Areas   │ │ Calendar │ │Documents │ │ Settings │  │
│  │ Module   │ │ Module   │ │ Module   │ │ Module   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                      │                                 │
└──────────────────────┼─────────────────────────────────┘
                       │
┌──────────────────────┼─────────────────────────────────┐
│              Supabase Services (used selectively)       │
│  ┌──────────┐                         ┌──────────┐     │
│  │  Auth    │                         │Realtime  │     │
│  │  (GoTrue)│                         │(WebSocket)│     │
│  └──────────┘                         └──────────┘     │
│                                                         │
│              Prisma connects directly                   │
│              via DATABASE_URL (TCP)                     │
│              ┌──────────┐                               │
│              │  Prisma  │  ←── Supabase Postgres        │
│              │  Client  │                               │
│              └──────────┘                               │
└─────────────────────────────────────────────────────────┘
```

### Module Responsibility & Public Surface

**Auth Module**
- Routes: `/login`, `/auth/callback`
- Handles: Google OAuth flow, session management, protected layout
- Exports: `useAuth()` hook (user, session, signOut), `<AuthGate>` component

**Project Module**
- Routes: `/projects`, `/projects/[projectId]`
- Handles: CRUD, project list, project detail (redirects to Kanban)
- Exports: `useProjects()`, `useProject(id)`, `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()`

**Kanban Module**
- Routes: `/board/[projectId]` (main view)
- Handles: Board view, columns, card drag-and-drop, column config, area filter
- Exports: `useBoard(projectId)`, `useColumns(projectId)`, `useMoveTask()`, `<KanbanBoard>`, `<KanbanColumn>`, `<KanbanCard>`

**Tasks Module**
- Routes: (embedded in Kanban — task detail panel, task modals)
- Handles: Task CRUD, assignment, priority, due dates, comments
- Exports: `useTask(id)`, `useTasks(projectId)`, `useCreateTask()`, `useUpdateTask()`, `useDeleteTask()`, `useComments(taskId)`, `useCreateComment()`

**Areas Module**
- Routes: `/settings/areas`
- Handles: Team area CRUD, task area assignment, area filtering
- Exports: `useAreas()`, `useCreateArea()`, `useUpdateArea()`, `useDeleteArea()`, `<AreaBadge>`, `<AreaFilter>`

**Calendar Module**
- Routes: `/calendar`
- Handles: Google Calendar auth, event fetch, event creation from tasks, calendar view
- Exports: `useCalendarEvents()`, `useScheduleEvent()`, `useCalendarAuth()`, `<CalendarView>`

**Documents Module**
- Routes: `/documents`, `/documents/[documentId]`
- Handles: Document CRUD, markdown editor, project-linking
- Exports: `useDocuments(projectId?)`, `useDocument(id)`, `useCreateDocument()`, `useUpdateDocument()`, `<DocumentEditor>`, `<MarkdownPreview>`

**Settings Module**
- Routes: `/settings`
- Handles: Profile, areas (see Areas module), integrations (Google Calendar)
- Exports: `<SettingsLayout>`, `<SettingsNav>`

### Module Dependency Graph (Directed)

```
Auth ──> (all modules — user context)
Areas ──> Tasks (area_id FK)
Projects ──> Tasks (project_id FK) + Kanban (board) + Documents (project_id FK)
Tasks ──> Calendar (scheduleEvent reads task)
Calendar ──> Tasks (task link in calendar events)
Documents ──> Projects (optional FK)
```

No circular dependencies. All database access goes through Prisma (in Route Handlers). Modules depend on each other via API calls, not direct imports of each other's components (except through the app router layout/page composition).

---

## 3. Data Model / Schema

### Entity-Relationship Diagram (text)

```
Users
  │
  ├──< TeamAreas (created_by)
  │
  ├──< TeamMemberAreas (user_id + area_id)
  │     │
  │     └──> TeamAreas
  │
  ├──< Projects (created_by)
  │
  ├──< Tasks (assignee_id)
  │     │
  │     ├──> Projects
  │     ├──> TeamAreas (area_id, nullable)
  │     ├──< Comments
  │     └──< CalendarEvents
  │
  ├──< Comments (author_id)
  │     └──> Tasks
  │
  ├──< Documents (created_by)
  │     └──> Projects (optional)
  │
  └──< CalendarAuth (user_id)
```

### Tables (SQL DDL)

#### `profiles` — extends Supabase auth.users

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup (Supabase trigger)
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

#### `team_areas`

```sql
create table public.team_areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#3b82f6', -- hex for badge
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

#### `team_member_areas` (post-MVP, schema ready but unused)

```sql
create table public.team_member_areas (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  area_id   uuid not null references public.team_areas(id) on delete cascade,
  unique(user_id, area_id)
);
```

#### `projects`

```sql
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  area_id     uuid references public.team_areas(id) on delete set null,
  created_by  uuid not null references public.profiles(id),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_projects_area on public.projects(area_id);
```

#### `project_columns`

```sql
create table public.project_columns (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  position    integer not null, -- 0-based ordering
  color       text, -- optional hex for column header
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(project_id, name)
);

create index idx_project_columns_project on public.project_columns(project_id);

-- Default columns for new projects
create function public.create_default_columns()
returns trigger as $$
begin
  insert into public.project_columns (project_id, name, position) values
    (new.id, 'To Do', 0),
    (new.id, 'In Progress', 1),
    (new.id, 'Done', 2);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.create_default_columns();
```

#### `tasks`

```sql
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  column_id     uuid not null references public.project_columns(id) on delete restrict,
  title         text not null,
  description   text,
  assignee_id   uuid references public.profiles(id) on delete set null,
  area_id       uuid references public.team_areas(id) on delete set null,
  priority      text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date      date,
  position      real not null default 0, -- fractional ordering for drag-and-drop
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Core indexes
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_column on public.tasks(column_id);
create index idx_tasks_assignee on public.tasks(assignee_id);
create index idx_tasks_area on public.tasks(area_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_position on public.tasks(project_id, column_id, position);
```

#### `comments`

```sql
create table public.comments (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content   text not null,
  created_at timestamptz not null default now()
);

create index idx_comments_task on public.comments(task_id);
```

#### `documents`

```sql
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null default '', -- raw markdown
  project_id  uuid references public.projects(id) on delete set null,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_documents_project on public.documents(project_id);
create index idx_documents_created_by on public.documents(created_by);

-- Full-text search index (post-MVP)
-- create index idx_documents_fts on public.documents using gin(to_tsvector('english', title || ' ' || content));
```

#### `calendar_auth`

```sql
create table public.calendar_auth (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade unique,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null, -- when access_token expires
  google_email  text, -- the Google account email
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

#### `calendar_events` (cached Google Calendar events + task-linked events)

```sql
create table public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  google_id     text, -- Google Calendar event ID (null if created locally)
  title         text not null,
  description   text,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  color         text,
  source        text not null default 'google' check (source in ('google', 'manual')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_calendar_user_time on public.calendar_events(user_id, start_time);
create index idx_calendar_task on public.calendar_events(task_id);
```

### Authorization Strategy

**MVP: No RLS, server-side auth check via Prisma.**

Since all database queries go through Prisma (not PostgREST), RLS is unnecessary. Authorization is enforced at the application layer in each Route Handler:

```typescript
// Pattern used in every Route Handler
export async function GET(req: Request) {
  const session = await getSession(req); // reads Supabase auth cookie
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await prisma.task.findMany({
    where: { project_id: params.projectId },
  });

  return Response.json({ data });
}
```

**Post-MVP:** Add `created_by` checks or role-based guards as the app grows. The `auth.uid()` is extracted from the Supabase session cookie via `getSession()` utility.

**Why not RLS:** RLS is tied to PostgREST (the `auth.uid()` function). Since we never hit PostgREST, RLS would be bypassed by Prisma's direct connection anyway. Server-side middleware is simpler and more debuggable.

### Billing-Relevant Queries

```sql
-- Task count per week (success metric)
select count(*) from tasks
where created_at >= date_trunc('week', now())
  and created_at < date_trunc('week', now()) + interval '1 week';

-- Projects created
select count(*) from projects;

-- Tasks completed (tasks moved to "Done" column)
-- Track via a `completed_at` column or log column moves.
-- Simpler for MVP: query tasks where column is the "Done" column.
```

---

## 4. API Contracts

### Architecture: Next.js Route Handlers (REST) + Prisma

Each endpoint is a Next.js Route Handler (`app/api/.../route.ts`). Prisma client is instantiated as a global singleton (to avoid multiple connections during hot reload). The Supabase session is read from cookies on every request for auth.

```
Request → Route Handler → getSession() → prisma.query() → Supabase Postgres
                                              ↑
                                     (direct TCP, no PostgREST)
```

**Why not tRPC:** REST is sufficient for 10-15 endpoints. tRPC adds complexity (procedure definitions, middleware) for marginal benefit at this scale. Route Handlers give us native HTTP semantics, easy to test with curl/fetch, and trivial to document.

### Endpoints

#### Auth (handled by Supabase Auth UI + client SDK)

| Method | Path | Description |
|--------|------|-------------|
| (handled client-side) | `/auth/callback` | OAuth redirect handler (Next.js page) |
| (Supabase client) | `signInWithOAuth('google')` | Initiate Google OAuth |
| (Supabase client) | `signInWithOtp(email)` | Magic link |

#### Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get current user's profile |
| PATCH | `/api/profile` | Update profile (name, avatar) |

#### Team Areas

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/areas` | List all team areas |
| POST | `/api/areas` | Create area (body: `{ name, color }`) |
| PATCH | `/api/areas/[id]` | Update area |
| DELETE | `/api/areas/[id]` | Delete area (must handle task reassignment) |
| GET | `/api/areas/[id]/impact` | Get count of tasks/projects referencing area (for delete confirmation) |

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects (?archived=false, ?area_id=...) |
| POST | `/api/projects` | Create project (body: `{ name, description, area_id }`) |
| GET | `/api/projects/[id]` | Get project detail |
| PATCH | `/api/projects/[id]` | Update project |
| DELETE | `/api/projects/[id]` | Archive/delete project |

#### Kanban Columns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/[projectId]/columns` | List columns for project (?includeTasks=true) |
| POST | `/api/projects/[projectId]/columns` | Add column (body: `{ name }`) |
| PATCH | `/api/projects/[projectId]/columns/[id]` | Rename/reorder column |
| DELETE | `/api/projects/[projectId]/columns/[id]` | Delete column (tasks must be moved first) |
| PUT | `/api/projects/[projectId]/columns/reorder` | Reorder columns (body: `{ orderedIds: [...] }`) |

#### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/[projectId]/tasks` | List tasks (?column_id, ?area_id, ?assignee_id) |
| POST | `/api/projects/[projectId]/tasks` | Create task (body: `{ title, description, column_id, assignee_id, area_id, priority, due_date }`) |
| GET | `/api/tasks/[id]` | Get task detail |
| PATCH | `/api/tasks/[id]` | Update task |
| DELETE | `/api/tasks/[id]` | Delete task |
| PUT | `/api/tasks/reorder` | Batch update positions (body: `{ updates: [{ id, column_id, position }] }`) |

#### Comments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks/[taskId]/comments` | List comments for task |
| POST | `/api/tasks/[taskId]/comments` | Create comment (body: `{ content }`) |
| DELETE | `/api/tasks/[taskId]/comments/[id]` | Delete own comment |

#### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/documents` | List documents (?project_id) |
| POST | `/api/documents` | Create document (body: `{ title, content, project_id? }`) |
| GET | `/api/documents/[id]` | Get document content |
| PATCH | `/api/documents/[id]` | Update document (body: `{ title?, content? }`) |
| DELETE | `/api/documents/[id]` | Delete document |

#### Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/auth` | Get Google Calendar auth status (is token valid?) |
| POST | `/api/calendar/auth` | Save Google OAuth tokens (called from callback) |
| DELETE | `/api/calendar/auth` | Revoke Google Calendar access |
| GET | `/api/calendar/events` | Fetch events from Google Calendar API (server-side) + local calendar_events |
| POST | `/api/calendar/schedule` | Create event on Google Calendar from task (body: `{ task_id, start_time, end_time, title? }`) |
| DELETE | `/api/calendar/events/[id]` | Delete event from Google Calendar (optional: also from local) |

### Response Conventions

```typescript
// Success
{ "data": T, "error": null }

// Error
{ "data": null, "error": { "code": "NOT_FOUND", "message": "Project not found" } }

// Pagination (for lists)
{ "data": T[], "error": null, "count": number }
```

### Error Codes

| Code | HTTP Status | When |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | Malformed request body |
| `NOT_FOUND` | 404 | Entity doesn't exist |
| `FORBIDDEN` | 403 | User not authorized for this action |
| `CONFLICT` | 409 | Duplicate name, optimistic update collision |
| `AUTH_ERROR` | 401 | No session / expired token |
| `GOOGLE_AUTH_ERROR` | 401 | Google token expired and refresh failed |
| `PRISMA_ERROR` | 500 | Database constraint violation or connection error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 5. File / Folder Structure

```
seorganize-b2b/
├── .env.local                    # DATABASE_URL (Supabase Postgres), Google OAuth client ID
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── prisma/
│   ├── schema.prisma             # Data model (models map to tables)
│   ├── migrations/               # Generated migration files
│   ├── seed.ts                   # Development seed data
│   └── client.ts                 # Singleton PrismaClient instance
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout (providers, fonts)
│   │   ├── page.tsx              # Redirect to /projects or login
│   │   ├── login/
│   │   │   └── page.tsx          # Login screen
│   │   │
│   │   ├── (authenticated)/      # Route group (layout with sidebar + topbar)
│   │   │   ├── layout.tsx        # AppLayout wrapper (sidebar + topbar + main)
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx      # Projects list
│   │   │   │   ├── [projectId]/
│   │   │   │   │   └── page.tsx  # Redirect to /board/[projectId]
│   │   │   │
│   │   │   ├── board/
│   │   │   │   └── [projectId]/
│   │   │   │       └── page.tsx  # Kanban board screen
│   │   │   │
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx      # Calendar view
│   │   │   │
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx      # Document list
│   │   │   │   └── [documentId]/
│   │   │   │       └── page.tsx  # Document editor
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx      # Redirect to /settings/profile
│   │   │       ├── profile/
│   │   │       │   └── page.tsx  # Profile settings
│   │   │       ├── areas/
│   │   │       │   └── page.tsx  # Team area management
│   │   │       └── integrations/
│   │   │           └── page.tsx  # Google Calendar integration
│   │   │
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts      # OAuth callback handler
│   │   │
│   │   └── api/                  # Route Handlers
│   │       ├── profile/
│   │       │   └── route.ts
│   │       ├── areas/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       ├── projects/
│   │       │   ├── route.ts
│   │       │   ├── [projectId]/
│   │       │   │   ├── route.ts
│   │       │   │   ├── columns/
│   │       │   │   │   ├── route.ts
│   │       │   │   │   ├── reorder/
│   │       │   │   │   │   └── route.ts
│   │       │   │   │   └── [columnId]/
│   │       │   │   │       └── route.ts
│   │       │   │   └── tasks/
│   │       │   │       └── route.ts
│   │       │   └── reorder/
│   │       │       └── route.ts  # Batch task reorder
│   │       ├── tasks/
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts
│   │       │   │   └── comments/
│   │       │   │       ├── route.ts
│   │       │   │       └── [commentId]/
│   │       │   │           └── route.ts
│   │       │   └── reorder/
│   │       │       └── route.ts
│   │       ├── documents/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       └── calendar/
│   │           ├── auth/
│   │           │   └── route.ts
│   │           ├── events/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       └── route.ts
│   │           └── schedule/
│   │               └── route.ts
│   │
│   ├── components/               # Shared / reusable components
│   │   ├── ui/                   # shadcn/ui re-exports
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── select.tsx
│   │   │   ├── checkbox.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   └── app-layout.tsx
│   │   ├── auth/
│   │   │   ├── auth-gate.tsx     # Wraps protected routes
│   │   │   └── login-form.tsx
│   │   ├── projects/
│   │   │   ├── project-card.tsx
│   │   │   ├── project-grid.tsx
│   │   │   ├── project-selector.tsx
│   │   │   └── project-form.tsx  # Create/edit modal
│   │   ├── kanban/
│   │   │   ├── kanban-board.tsx
│   │   │   ├── kanban-column.tsx
│   │   │   ├── kanban-card.tsx
│   │   │   ├── task-detail-panel.tsx
│   │   │   ├── task-detail-modal.tsx
│   │   │   └── task-form.tsx     # Create/edit task modal
│   │   ├── calendar/
│   │   │   ├── calendar-view.tsx
│   │   │   ├── calendar-event.tsx
│   │   │   ├── schedule-event-modal.tsx
│   │   │   └── upcoming-tasks-panel.tsx
│   │   ├── documents/
│   │   │   ├── document-list.tsx
│   │   │   ├── document-row.tsx
│   │   │   ├── document-editor.tsx
│   │   │   └── markdown-preview.tsx
│   │   ├── areas/
│   │   │   ├── area-badge.tsx
│   │   │   ├── area-filter.tsx
│   │   │   └── area-list.tsx
│   │   ├── comments/
│   │   │   ├── comment-list.tsx
│   │   │   ├── comment-item.tsx
│   │   │   └── comment-input.tsx
│   │   └── shared/
│   │       ├── empty-state.tsx
│   │       ├── loading-state.tsx
│   │       ├── error-boundary.tsx
│   │       ├── confirm-dialog.tsx
│   │       └── page-header.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-projects.ts
│   │   ├── use-tasks.ts
│   │   ├── use-kanban.ts
│   │   ├── use-comments.ts
│   │   ├── use-areas.ts
│   │   ├── use-documents.ts
│   │   ├── use-calendar.ts
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   │
│   ├── lib/                      # Utilities, helpers, server-side logic
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client (auth: signIn, signOut, getSession)
│   │   │   ├── server.ts        # Server-side session reader (cookie-based)
│   │   │   └── realtime.ts       # Realtime subscription helpers
│   │   ├── google/
│   │   │   ├── calendar.ts      # Google Calendar API client
│   │   │   ├── oauth.ts         # OAuth flow helpers
│   │   │   └── types.ts         # Google API types
│   │   ├── utils.ts              # General utilities
│   │   ├── constants.ts          # App constants
│   │   ├── reorder.ts            # Reorder algorithm (see §6)
│   │   └── realtime.ts           # Supabase Realtime subscription setup
│   │
│   ├── stores/                   # React Context for UI state only
│   │   ├── auth-context.tsx
│   │   ├── sidebar-context.tsx
│   │   └── theme-context.tsx
│   │
│   └── styles/
│       ├── globals.css           # Tailwind directives + custom CSS
│       └── editor.css            # CodeMirror / MD editor overrides
│
├── public/
│   ├── logo.svg
│   ├── favicon.ico
│   └── fonts/                   # Inter + JetBrains Mono (self-hosted)
│
└── tests/                       # (optional, can be alongside source)
    ├── e2e/
    │   └── kanban.spec.ts
    └── unit/
        ├── reorder.test.ts
        └── calendar.test.ts
```

### Key Structural Decisions

- **`(authenticated)` route group**: Contains all pages that need sidebar + topbar. The `layout.tsx` in this group provides the common shell. Pages outside (login) don't get it.
- **Components split by domain**: `components/kanban/`, `components/calendar/`, etc. Each domain folder may also contain its own sub-components used only in that domain.
- **Hooks co-located**: All data-fetching hooks in `hooks/`. Each hook uses TanStack Query to call the API endpoints and cache results.
- **No `services/` layer**: API routes directly call Prisma. In a monolith this small, an extra service abstraction indirection would be overhead without benefit. If a route handler grows beyond ~50 lines, extract logic into `lib/`.
- **Prisma singleton pattern**: `prisma/client.ts` exports a singleton `PrismaClient` to avoid multiple instances during Next.js hot reload. Standard pattern: `globalThis.prisma ?? new PrismaClient()`.
- **shadcn/ui re-exports**: Components in `components/ui/` are the installed shadcn primitives. Domain components import from these rather than directly from shadcn.

---

## 6. Key Algorithm Decisions

### 6.1 Reordering (Drag-and-Drop)

**Problem:** When a user drags a card between positions or between columns, we need to assign a new `position` value without reindexing every card.

**Solution: Fractional Indexing (position as `real` in Postgres)**

```typescript
// Given two adjacent positions, pick a midpoint
function getInsertPosition(before: number | null, after: number | null): number {
  if (before === null && after === null) return 65536; // first item
  if (before === null) return after! / 2;             // start of list
  if (after === null) return before + 65536;          // end of list
  return (before + after) / 2;                        // between two items
}
```

**Why not integer positions with batch reindex?** Fractional indexing avoids updating every card on every move. Each drag updates exactly one row (the moved card). No batch reindex needed until positions drift close enough (e.g., difference < 0.001), at which point a periodic reindex runs silently.

**Cross-column move:**
1. User drops card from column A to column B at position `p`
2. Client calls `PUT /api/tasks/reorder` with `{ id, column_id, position }`
3. Server validates column belongs to same project, updates task
4. On success: card appears in new column at correct position
5. On failure: Optimistic rollback

### 6.2 Conflict Resolution

**Strategy: Last-Writer-Wins (LWW)**

For a single-user MVP, LWW is sufficient. No merge logic needed.

**Implementation:**
- Each entity has `updated_at` (timestamptz). On update, server sets `updated_at = now()`.
- TanStack Query invalidates stale data on refetch, so outdated local state is replaced.
- Optimistic updates (drag reorder) that fail trigger a full refetch of the board.

**Post-MVP considerations:**
- `updated_at` comparison on write: if the client's `updated_at` is older than the server's, return `409 Conflict` with the latest server state.
- Real-time subscriptions (Supabase Realtime) push changes to all connected clients within seconds.

### 6.3 Optimistic Updates

**Pattern used throughout TanStack Query mutations:**

```typescript
// On drag-end
const mutation = useMutation({
  mutationFn: (update) => api.moveTask(update),
  onMutate: async (newPosition) => {
    // 1. Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['board', projectId] });
    // 2. Snapshot previous state
    const previous = queryClient.getQueryData(['board', projectId]);
    // 3. Optimistically update to new position
    queryClient.setQueryData(['board', projectId], (old) => applyMove(old, newPosition));
    // 4. Return snapshot for rollback
    return { previous };
  },
  onError: (err, newPosition, context) => {
    // Rollback on failure
    queryClient.setQueryData(['board', projectId], context!.previous);
    toast.error('Failed to move task');
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['board', projectId] });
  },
});
```

**When optimistic updates happen:**
- Drag-and-drop card reorder
- Task creation (card appears immediately in column)
- Comment creation (appears at bottom of thread)
- Status change (column switch)

**When NOT to optimistically update:**
- Google Calendar event creation (external API — wait for response)
- Token refresh operations
- File uploads (not in MVP)

### 6.4 Supabase Realtime Subscriptions

Supabase Realtime listens to Postgres replication (logical decoding) and pushes changes to connected clients via WebSocket. This is the **only** Supabase service (besides Auth) that reaches the browser. No DB queries go through Supabase.

**Setup (client-side):**

```typescript
// In useKanban hook (or a dedicated useRealtime hook)
import { supabase } from '@/lib/supabase/client';

useEffect(() => {
  const channel = supabase
    .channel(`board:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        // When another client (or same client in another tab) changes a task,
        // invalidate the board query to refetch via Prisma
        queryClient.invalidateQueries({ queryKey: ['board', projectId] });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [projectId]);
```

**Performance considerations:**
- Subscribe per-project board, not globally
- Reconnection handled by Supabase client (built-in exponential backoff)
- For MVP, subscribe to `*` events (insert/update/delete). Post-MVP, filter by column to reduce noise.
- This is a **read-only** subscription. Writes go through Next.js Route Handlers → Prisma.

### 6.5 Column Reorder Algorithm

Same fractional indexing as task reorder, but for `project_columns.position`. A drag-handle on columns triggers:

```typescript
// PUT /api/projects/[projectId]/columns/reorder
{ "orderedIds": ["col-a", "col-c", "col-b", ...] }
```

Server assigns positions 0, 65536, 131072, ... (evenly spaced integers). This is a full reindex — acceptable because columns are few (< 10 per project).

---

## 7. Google Calendar Integration

### 7.1 OAuth Flow

```
User clicks "Connect Google Calendar"
  │
  ▼
Opens popup to:
  https://accounts.google.com/o/oauth2/v2/auth
    ?client_id=<NEXT_PUBLIC_GOOGLE_CLIENT_ID>
    &redirect_uri=<ORIGIN>/api/calendar/auth/callback
    &response_type=code
    &scope=https://www.googleapis.com/auth/calendar.readonly
               https://www.googleapis.com/auth/calendar.events
    &access_type=offline
    &prompt=consent
  │
  ▼
User consents → Google redirects to /api/calendar/auth/callback?code=...
  │
  ▼
Server exchanges code for tokens (POST to Google token endpoint):
  - access_token (1 hour)
  - refresh_token (long-lived, returned on first auth only)
  - expires_at = now + expires_in
  │
  ▼
Store tokens in calendar_auth table (encrypted at rest via Supabase)
  │
  ▼
Redirect user back to /calendar with success toast
```

**Token Refresh (handled server-side with Prisma):**

```typescript
// lib/google/oauth.ts
import { prisma } from '@/prisma/client';

async function getValidAccessToken(userId: string): Promise<string> {
  const auth = await prisma.calendarAuth.findUnique({
    where: { user_id: userId },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });

  if (!auth) throw new Error('Google Calendar not connected');

  if (auth.expires_at > new Date()) {
    return auth.access_token; // still valid
  }

  // Refresh
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: auth.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  // Update stored tokens
  await prisma.calendarAuth.update({
    where: { user_id: userId },
    data: {
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}
```

### 7.2 Google Calendar API Client

```typescript
// lib/google/calendar.ts
class GoogleCalendarClient {
  constructor(private accessToken: string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async fetchEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Google API error: ${res.status}`);
    const data = await res.json();
    return data.items.map(this.transformEvent);
  }

  async createEvent(event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
  }): Promise<CalendarEvent> {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(event),
      }
    );
    if (!res.ok) throw new Error(`Google API error: ${res.status}`);
    return this.transformEvent(await res.json());
  }

  async deleteEvent(googleEventId: string): Promise<void> {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      { method: 'DELETE', headers: this.headers }
    );
  }

  private transformEvent(item: any): CalendarEvent {
    return {
      googleId: item.id,
      title: item.summary,
      description: item.description,
      startTime: item.start.dateTime || item.start.date,
      endTime: item.end.dateTime || item.end.date,
      link: item.htmlLink,
    };
  }
}
```

### 7.3 Schedule Task as Calendar Event

```
User clicks "Schedule in Calendar" on task detail
  │
  ▼
ScheduleEventModal opens with:
  - Task title pre-filled as event title
  - Due date pre-filled (or prompt if none)
  - Duration picker (default 1h)
  - Project name appended to title (optional toggle)
  │
  ▼
POST /api/calendar/schedule
  {
    task_id: "uuid",
    start_time: "2026-07-30T09:00:00Z",
    end_time: "2026-07-30T10:00:00Z",
    title: "Design review — Acme Corp Onboarding"  // task title + project
  }
  │
  ▼
Server:
  1. Gets valid access token (refresh if needed)
  2. Creates event via Google Calendar API
  3. Stores event in calendar_events table with google_id + task_id link
  4. Returns event data
  │
  ▼
UI updates: task card shows calendar icon indicator
```

### 7.4 Event Caching Strategy

- On `/calendar` page load: fetch last 4 weeks of Google events + local `calendar_events` rows
- Cache `calendar_events` table with `google_id` to avoid duplicates
- On Google Calendar write (schedule), also store locally
- On Google Calendar read, merge: `SELECT * FROM calendar_events WHERE user_id = ?` (local) + Google API (remote)
- **Sync direction (MVP):** Read Google Calendar, write to Google Calendar. No 2-way sync (post-MVP).

### 7.5 Webhooks (Post-MVP)

Google Calendar push notifications via webhook:
- Register a `watch` on the user's primary calendar
- Google POSTs to `/api/calendar/webhook` when events change
- Webhook handler re-fetches changed events and updates `calendar_events` table
- Real-time subscription pushes update to frontend

**MVP decision:** No webhooks. Events are polled on page load and via manual refresh button.

---

## 8. .md Document Storage & Editor

### 8.1 Storage Model

Documents stored as TEXT in `documents.content` column.

**Why not Supabase Storage (S3):**
- Documents are small (meeting notes, specs — typically < 50 KB)
- Storing as text in Postgres means:
  - No additional storage service dependency
  - Full-text search is a Postgres index away (post-MVP)
  - Backups are a single SQL dump
  - No CORS configuration, no signed URLs
  - RLS policies apply uniformly

**Trade-off:** Large documents (> 1 MB) would be better in object storage. For internal meeting notes and specs, this won't happen. If it does, we can migrate individual rows to Supabase Storage with a flag column.

### 8.2 Rendering Pipeline

```
View Mode:
  documents.content (raw markdown)
    →   unified (remark + rehype ecosystem)
    →   react-markdown
    →   Rendered HTML (syntax-highlighted, linked)

Edit Mode:
  @uiw/react-md-editor (CodeMirror-based)
  →   Left pane: raw markdown
  →   Right pane: live rendered preview
  →   Save: PUT /api/documents/[id] with { content }
```

**Dependencies:**
- `react-markdown` — render markdown in view mode
- `remark-gfm` — GitHub-flavored markdown (tables, strikethrough, task lists)
- `rehype-highlight` — code syntax highlighting
- `rehype-raw` — raw HTML pass-through (safe mode)
- `@uiw/react-md-editor` — CodeMirror 6-based split editor with toolbar

### 8.3 Markdown Editor Architecture

```
┌─────────────────────────────────────────┐
│ DocumentEditor                          │
│  ┌─────────────────────────────────────┐│
│  │ DocumentTitleInput (contentEditable) ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ Toolbar                             ││
│  │ [B] [I] [H] [•] [1.] [🔗] [👁]    ││
│  └─────────────────────────────────────┘│
│  ┌──────────────────┬──────────────────┐│
│  │ EditorPane       │ PreviewPane      ││
│  │ (CodeMirror)     │ (react-markdown) ││
│  │                  │                  ││
│  │ raw text input   │ rendered HTML    ││
│  │ with markdown    │ syntax-highlight ││
│  │ syntax highlight │                  ││
│  └──────────────────┴──────────────────┘│
│  View toggle: [Edit] [Preview] [Split]  │
└─────────────────────────────────────────┘
```

**State management:**

```typescript
// hooks/use-documents.ts
const { data: document, isLoading } = useDocument(id);
const [localContent, setLocalContent] = useState(document?.content ?? '');
const [isDirty, setIsDirty] = useState(false);

// Auto-save (debounced, 3s after last change)
useDebouncedEffect(() => {
  if (isDirty) {
    updateDocument.mutate({ content: localContent });
  }
}, [localContent], 3000);

// Manual save button
function handleSave() {
  updateDocument.mutate({ content: localContent });
}
```

### 8.4 View Modes

| Mode | Description | Component |
|------|-------------|-----------|
| Split (default) | Editor on left, preview on right ≥ 768px; stacked on mobile | `SplitPane` |
| Edit only | Full-width editor, no preview | Tab toggle |
| Preview only | Full-width rendered markdown, editor hidden | Tab toggle |

**Mobile behavior:** SplitPane becomes a tab toggle: "Edit" tab shows editor, "Preview" tab shows rendered view. `useMediaQuery('(max-width: 767px)')` drives the switch.

### 8.5 Document Linking to Projects

```typescript
// When creating/editing a document:
// GET /api/projects → populate project dropdown
// PATCH /api/documents/[id] with { project_id: "uuid" | null }
// Documents list shows project-linked docs under project filter tabs
// project_id is optional (null = "global" document)
```

### 8.6 Last-Writer-Wins (MVP)

No concurrent editing in MVP. If two tabs edit the same document:
- Last save wins (no merge)
- No conflict detection
- Post-MVP: add `updated_at` comparison, warn if stale

---

## Appendix A: Implementation Order (MVP)

| Phase | Features | Est. Effort |
|-------|----------|-------------|
| **1. Scaffold** | Next.js project, Tailwind + shadcn/ui setup, Supabase client, auth (Google OAuth + magic link), AppLayout shell (sidebar + topbar) | 2 days |
| **2. Team Areas** | CRUD, area badge component, area filter component, settings page | 1 day |
| **3. Projects** | CRUD, project list page, project card, project selector in sidebar, default columns on creation | 1 day |
| **4. Tasks + Kanban** | Task CRUD, Kanban board with columns, drag-and-drop (same column + cross-column), task detail panel, priority/due date/area display | 3 days |
| **5. Comments** | Comment CRUD on task detail panel, comment list + input | 0.5 day |
| **6. Calendar** | Google OAuth flow, event fetch + display, event creation from task, calendar view (week) | 2 days |
| **7. Documents** | Document CRUD, markdown editor (split view), document list, project linking | 1.5 days |
| **8. Polish** | Empty states, error boundaries, loading states, responsive tweaks, edge case handling | 1 day |
| **Total** | | **~12 days** |

---

## Appendix B: ADR Index

The following architectural decisions are embedded in this document:

| ADR | Decision |
|-----|----------|
| ADR-001 | Use Next.js App Router over Pages Router |
| ADR-002 | Prisma ORM over Supabase JS client (no PostgREST) |
| ADR-003 | Store documents as TEXT in Postgres (not object storage) |
| ADR-004 | Use fractional indexing for task reorder (real position column) |
| ADR-005 | Deploy on Vercel (not VPS) |
| ADR-006 | Use Supabase Realtime (not Pusher/Ably) |
| ADR-007 | Use TanStack Query for server state (not Zustand/Redux) |
| ADR-008 | REST API over tRPC |
| ADR-009 | Last-Writer-Wins conflict resolution for MVP |
| ADR-010 | Application-layer auth (no RLS, Prisma bypasses PostgREST) |
| ADR-011 | CodeMirror-based editor (not MDXEditor) |

---

*End of Architecture Document*
