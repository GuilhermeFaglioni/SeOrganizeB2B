# SeOrganizeB2B — Sprint Plan

> **Author:** Planner Agent
> **Date:** 2026-07-29
> **Total Est. Effort:** ~11 days (2 sprints)
> **Team:** Solo founder (single developer)

---

## Sprint 1: Foundation (6 stories, ~6.5 days)

### Story 1.1 — Project Scaffold + Infrastructure

**Effort:** M (2 days)
**Dependencies:** None

**Description:** Initialize the Next.js 14 project with App Router, install all dependencies, configure Tailwind with design tokens, set up shadcn/ui primitives, create Prisma schema + migrations, seed script, Supabase client singletons, and the error/loading/shared component library.

**Acceptance Criteria:**
- [ ] `npm run build` exits 0 with no errors
- [ ] `npm run lint` exits 0 on `src/`
- [ ] File `prisma/schema.prisma` contains all 8 tables: `profiles`, `team_areas`, `team_member_areas`, `projects`, `project_columns`, `tasks`, `comments`, `documents`, `calendar_auth`, `calendar_events`
- [ ] File `prisma/client.ts` exports a singleton `PrismaClient` (pattern: `globalThis.prisma ?? new PrismaClient()`)
- [ ] File `tailwind.config.ts` contains custom colors: `sidebar`, `page`, `page-alt`, `accent`, `accent-hover`, `text-primary`, `text-secondary`, `text-muted`, `border`, `border-dark`, `success`, `warning`, `danger`
- [ ] File `tailwind.config.ts` contains custom font family: `Inter` (sans), `JetBrains Mono` (mono)
- [ ] File `src/lib/supabase/client.ts` exports `supabase` client instance
- [ ] File `src/lib/supabase/server.ts` exports `getSession()` function (reads auth cookie)
- [ ] File `src/app/globals.css` contains `@tailwind base/components/utilities` directives
- [ ] File `src/components/ui/` contains at minimum: `button.tsx`, `input.tsx`, `dialog.tsx`, `badge.tsx`, `avatar.tsx`, `toast.tsx`, `select.tsx`, `checkbox.tsx`, `dropdown-menu.tsx`
- [ ] File `src/components/shared/empty-state.tsx` exists and renders `data-testid="empty-state"`
- [ ] File `src/components/shared/loading-state.tsx` exists and renders `data-testid="loading-state"`
- [ ] File `src/components/shared/error-boundary.tsx` exists
- [ ] File `src/components/shared/confirm-dialog.tsx` exists and renders `data-testid="confirm-dialog"`
- [ ] File `src/lib/constants.ts` exports `APP_NAME = 'SeOrganizeB2B'`
- [ ] File `src/lib/utils.ts` exports `cn()` utility (clsx + tailwind-merge)
- [ ] Prisma migration applies: `npx prisma migrate dev` exits 0
- [ ] Prisma seed runs: `npx prisma db seed` exits 0
- [ ] File `.env.example` contains `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] `npm run dev` starts without crash on `localhost:3000`

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.1.1 | Init Next.js 14 + TypeScript strict | `tsconfig.json`, `next.config.js`, `package.json` | `npx create-next-app@14` with App Router, src directory, import alias `@/` | `npm run build` passes |
| 1.1.2 | Install all dependencies | `package.json` | Dependencies: prisma, @prisma/client, @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, @dnd-kit/core, @dnd-kit/sortable, @fullcalendar/react, @fullcalendar/core, @fullcalendar/daygrid, @fullcalendar/timegrid, @fullcalendar/interaction, @uiw/react-md-editor, react-markdown, remark-gfm, rehype-highlight, rehype-raw, tailwindcss, shadcn/ui (npx shadcn@latest init), clsx, tailwind-merge, lucide-react | `npm install` exits 0 |
| 1.1.3 | Configure Tailwind with design tokens | `tailwind.config.ts`, `src/app/globals.css` | Map all corporate palette tokens from handoff-design.md §1. Colors: sidebar=#1e293b, page=#f1f5f9, accent=#2563eb, etc. Fonts: Inter + JetBrains Mono. Border-radius default: 6px. | `npm run dev` renders body with `bg-page text-text-primary` |
| 1.1.4 | Install shadcn/ui primitives | `src/components/ui/*.tsx` | Run `npx shadcn@latest add button input dialog badge avatar toast select checkbox dropdown-menu popover` | Each component file exists |
| 1.1.5 | Write Prisma schema + migration | `prisma/schema.prisma`, `prisma/migrations/` | Models: Profile, TeamArea, TeamMemberArea, Project, ProjectColumn, Task, Comment, Document, CalendarAuth, CalendarEvent. Fields matching handoff-arch.md §3. Profile auto-create trigger in migration SQL. Default columns trigger in migration SQL. | `npx prisma generate` exits 0 |
| 1.1.6 | Create Prisma singleton client | `prisma/client.ts` | `const prisma = globalThis.prisma ?? new PrismaClient()` + `if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma` | Import works without error |
| 1.1.7 | Create seed script | `prisma/seed.ts` | Seeds: 3 team areas (Sales, Engineering, Marketing), 2 sample projects with default columns, 5 sample tasks | `npx prisma db seed` inserts rows |
| 1.1.8 | Create Supabase client singletons | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Browser client: `createBrowserClient()`. Server: `createServerClient()` reading cookies. Export `getSession()`. | Both imports resolve without error |
| 1.1.9 | Create shared components | `src/components/shared/*.tsx` | EmptyState (icon+title+description+cta props), LoadingState (spinner+text props), ErrorBoundary (class-based, catches children errors), ConfirmDialog (uses shadcn dialog + destructive button) | Each component renders `data-testid` attribute |
| 1.1.10 | Create constants + utils | `src/lib/constants.ts`, `src/lib/utils.ts` | `APP_NAME`, `cn()` using clsx + tailwind-merge | `cn('a', false && 'b')` returns `'a'` |

---

### Story 1.2 — Auth + App Layout Shell

**Effort:** M (1.5 days)
**Dependencies:** Story 1.1

**Description:** Implement Google OAuth + magic link via Supabase Auth. Create the AuthGate component that redirects unauthenticated users to `/login`. Build the AppLayout shell with dark sidebar (240px) + white top bar (56px) + content area. Login page with email input, Google Sign-In button, and branded card.

**Acceptance Criteria:**
- [ ] File `src/app/login/page.tsx` renders `data-testid="login-page"`
- [ ] File `src/app/login/page.tsx` contains button with `data-testid="google-sign-in"`
- [ ] File `src/app/login/page.tsx` contains input with `data-testid="email-input"`
- [ ] File `src/app/login/page.tsx` does NOT render `sidebar` data-testid
- [ ] File `src/app/auth/callback/route.ts` exists and handles OAuth code exchange
- [ ] File `src/components/auth/auth-gate.tsx` wraps children and redirects to `/login` if no session
- [ ] File `src/stores/auth-context.tsx` exports `AuthProvider` and `useAuth()` returning `{ user, session, signOut, isLoading }`
- [ ] File `src/components/layout/sidebar.tsx` renders `data-testid="sidebar"` with width `w-[240px]`
- [ ] File `src/components/layout/topbar.tsx` renders `data-testid="topbar"` with height `h-14`
- [ ] File `src/components/layout/app-layout.tsx` renders both sidebar + topbar + main content slot
- [ ] File `src/app/(authenticated)/layout.tsx` imports and renders `AppLayout`
- [ ] File `src/app/(authenticated)/layout.tsx` wraps content in `AuthProvider` + `QueryClientProvider`
- [ ] Unauthenticated access to any route under `(authenticated)` redirects to `/login`
- [ ] File `src/app/(authenticated)/page.tsx` redirects to `/board/[projectId]` or shows project list
- [ ] Login card matches wireframe 3.1: centered, max-w-[400px], white bg, shadow, rounded-xl
- [ ] Sidebar nav items exist: Board, Calendar, Documents, Settings (with `data-testid="nav-board"`, etc.)
- [ ] `data-testid="sidebar-logo"` renders with app name

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.2.1 | Implement Supabase Auth hooks | `src/hooks/use-auth.ts`, `src/stores/auth-context.tsx` | `use-auth.ts`: wraps `supabase.auth` methods. `AuthContext`: provides user, session, signIn (Google OAuth + magic link), signOut. Uses `onAuthStateChange` listener. | `useAuth()` returns object with expected shape |
| 1.2.2 | Create auth callback handler | `src/app/auth/callback/route.ts` | Next.js Route Handler. Reads `code` from query params, calls `supabase.auth.exchangeCodeForSession()`, redirects to origin. | Visiting `/auth/callback?code=...` processes exchange |
| 1.2.3 | Build login page | `src/app/login/page.tsx` | Centered card layout. Logo mark (48px square, brand-500 bg, white "S"). Email input + "Continue with Email" button (magic link). Divider "or". "Sign in with Google" button (outline style). "No account? Create one" link. | `data-testid="login-page"` renders on `/login` |
| 1.2.4 | Create AuthGate component | `src/components/auth/auth-gate.tsx` | Client component that calls `useAuth()`. If loading → `<LoadingState>`. If no session → redirect to `/login`. If session → render children. | Unauthenticated user sees `/login` |
| 1.2.5 | Build sidebar | `src/components/layout/sidebar.tsx` | Dark bg (#1e293b), 240px wide, full height. Sections: Logo area (56px, bottom border), ProjectSelector (sidebar label + dropdown), NavMenu (Board/Calendar/Documents/Settings with icons), TeamAreaFilter (checkbox list), UserInfo (avatar + name + email). Nav items: 8px/12px padding, 14px font, icon 16px, gap 12px. | `data-testid="sidebar"` renders all sections |
| 1.2.6 | Build top bar | `src/components/layout/topbar.tsx` | Height 56px, white bg, border-bottom. Left: PageTitle + ProjectBadge. Right: SearchInput (224px) + PrimaryButton. | `data-testid="topbar"` renders |
| 1.2.7 | Build AppLayout | `src/components/layout/app-layout.tsx` | Flex container: sidebar (fixed 240px) + main area (flex-1, flex-col). Main area: topbar (h-14) + content (flex-1, overflow-auto). | Layout renders with correct structure |
| 1.2.8 | Create authenticated route group | `src/app/(authenticated)/layout.tsx` | Wraps children in `<AuthGate>` → `<AuthProvider>` → `<QueryClientProvider>` → `<AppLayout>`. Sets up TanStack Query client with defaults. | All routes under `(authenticated)` have sidebar |
| 1.2.9 | Configure root page redirect | `src/app/(authenticated)/page.tsx` | If user has projects → redirect to first project's board. If no projects → redirect to `/projects`. | Root redirects to `/projects` |

---

### Story 1.3 — Team Areas CRUD

**Effort:** S (1 day)
**Dependencies:** Story 1.2

**Description:** Full CRUD for team areas. Settings page (/settings/areas) with area list, inline add/edit modal, delete confirmation with impact warning. Area badge component (pill style with color). Area filter component for sidebar. Backend REST API with Prisma.

**Acceptance Criteria:**
- [ ] `GET /api/areas` returns `{ data: Area[], error: null }`
- [ ] `POST /api/areas` with `{ name }` creates area and returns `{ data: Area, error: null }`
- [ ] `PATCH /api/areas/[id]` with `{ name }` updates area
- [ ] `DELETE /api/areas/[id]` deletes area (sets null on tasks/projects referencing it)
- [ ] `GET /api/areas/[id]/impact` returns `{ data: { tasks: number, projects: number } }`
- [ ] File `src/app/settings/areas/page.tsx` renders `data-testid="areas-settings-page"`
- [ ] File `src/components/areas/area-badge.tsx` renders pill with colored dot + name, `data-testid="area-badge"`
- [ ] File `src/components/areas/area-filter.tsx` renders checkboxes for each area, `data-testid="area-filter"`
- [ ] File `src/components/areas/area-list.tsx` renders table with name, stats (members/tasks), edit/delete buttons
- [ ] Add Area modal (`data-testid="add-area-modal"`) validates duplicate name → shows error
- [ ] Delete Area modal (`data-testid="delete-area-modal"`) shows impact count (X tasks, Y projects affected)
- [ ] Area list shows "No areas yet" empty state when none exist
- [ ] `npm run build` exits 0

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.3.1 | Create areas API routes | `src/app/api/areas/route.ts`, `src/app/api/areas/[id]/route.ts`, `src/app/api/areas/[id]/impact/route.ts` | GET list, POST create, PATCH update, DELETE delete (on delete sets `area_id = null` on tasks + projects). Impact endpoint counts references. Auth check via `getSession()`. | `curl -X POST /api/areas -d '{"name":"Sales"}'` returns 200 |
| 1.3.2 | Create useAreas hook | `src/hooks/use-areas.ts` | TanStack Query: `useAreas()` (list), `useCreateArea()` (mutation), `useUpdateArea()` (mutation), `useDeleteArea()` (mutation), `useAreaImpact(id)` (query). Optimistic updates for create. | Hook exports all 5 query/mutation functions |
| 1.3.3 | Build AreaBadge component | `src/components/areas/area-badge.tsx` | Pill badge: 12px medium font, 4px/10px padding, border-radius 999px. Props: `{ name, color, compact?: boolean }`. Compact mode: 6px colored dot only. Color comes from area.color or defaults to area name from the color table. | `<AreaBadge name="Sales" />` renders blue pill |
| 1.3.4 | Build AreaFilter component | `src/components/areas/area-filter.tsx` | Checkbox list in sidebar section. Props: `{ areas, selected, onToggle }`. Each: label + checkbox. Calls `onToggle(areaId)` when clicked. | `data-testid="area-filter"` renders checkboxes |
| 1.3.5 | Build AreaList component | `src/components/areas/area-list.tsx` | Table: area name + color dot + stats (member count, task count) + edit/delete buttons. Uses `useAreas()` + `useAreaImpact()`. | `data-testid="area-list"` renders rows |
| 1.3.6 | Build settings areas page | `src/app/(authenticated)/settings/areas/page.tsx` | Settings page with AreaList, Add Area button, AddEditAreaModal (name input + color picker), DeleteConfirmModal (shows impact). Uses `useCreateArea/useUpdateArea/useDeleteArea`. | `data-testid="areas-settings-page"` renders |
| 1.3.7 | Wire sidebar area filter | `src/components/layout/sidebar.tsx` | Add TeamAreaFilter section at bottom of sidebar. Fetch areas via `useAreas()`. Store selected filters in URL search params or React Context. | Sidebar shows area checkboxes |

---

### Story 1.4 — Projects CRUD

**Effort:** S (1 day)
**Dependencies:** Story 1.3

**Description:** Full CRUD for projects. Projects list page (/projects) with 2-column card grid. Project creation modal (name, description, team area). Project selector dropdown in sidebar. Default Kanban columns (To Do / In Progress / Done) auto-created via DB trigger. Empty states.

**Acceptance Criteria:**
- [ ] `GET /api/projects` returns project list with task count, member count, area info
- [ ] `POST /api/projects` creates project + triggers default columns (3 rows in project_columns)
- [ ] `PATCH /api/projects/[id]` updates project fields
- [ ] `DELETE /api/projects/[id]` archives project (soft delete: sets `archived = true`)
- [ ] File `src/app/(authenticated)/projects/page.tsx` renders `data-testid="projects-page"`
- [ ] File `src/components/projects/project-card.tsx` renders title, description, area badge, stats row, `data-testid="project-card"`
- [ ] File `src/components/projects/project-grid.tsx` renders 2-column grid of cards on desktop, 1 on mobile
- [ ] File `src/components/projects/project-selector.tsx` renders dropdown with project list, `data-testid="project-selector"`
- [ ] File `src/components/projects/project-form.tsx` renders modal with name (required), description, area dropdown
- [ ] Creating project redirects to `/board/[projectId]`
- [ ] Zero projects → shows empty state with "Create your first project" prompt (`data-testid="empty-projects"`)
- [ ] Duplicate project name shows validation error
- [ ] `data-testid="project-card"` exists for each project

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.4.1 | Create projects API routes | `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts` | GET list (with task count via `_count`), POST create, PATCH update, DELETE archive (set `archived=true`). Auth check. | `POST /api/projects` creates project + 3 columns |
| 1.4.2 | Create useProjects hook | `src/hooks/use-projects.ts` | `useProjects()` listing, `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()` mutations with cache invalidation. | Hooks export expected signatures |
| 1.4.3 | Build ProjectCard component | `src/components/projects/project-card.tsx` | Card: white bg, border, rounded-xl (8px), shadow-sm. Title 16px semibold. Description 14px secondary. Stats row: area badge (from area_id), task count, member count. Chevron arrow right. | `<ProjectCard project={...} />` renders all fields |
| 1.4.4 | Build ProjectGrid component | `src/components/projects/project-grid.tsx` | CSS grid: 2 cols desktop, 1 col tablet/mobile. Maps over projects → `<ProjectCard>`. Empty state when length = 0. | Grid renders correct columns |
| 1.4.5 | Build ProjectSelector component | `src/components/projects/project-selector.tsx` | Dropdown in sidebar. Uses shadcn Select. Fetches projects via `useProjects()`. On select navigates to `/board/[projectId]`. Shows current project as selected. | `data-testid="project-selector"` shows project names |
| 1.4.6 | Build ProjectForm modal | `src/components/projects/project-form.tsx` | Modal: name (required, validate non-empty + unique), description (textarea, optional), area_id (dropdown from useAreas). On submit: calls useCreateProject, navigates to new project board on success. | Form validates required name field |
| 1.4.7 | Build projects list page | `src/app/(authenticated)/projects/page.tsx` | Top bar title "Projects". "+ New Project" button → opens ProjectForm modal. Content: ProjectGrid with useProjects(). Empty state when no projects. | `data-testid="projects-page"` renders |

---

### Story 1.5 — Kanban Board + Task CRUD

**Effort:** L (2.5 days)
**Dependencies:** Story 1.4

**Description:** Core feature — per-project Kanban board with drag-and-drop cards. Columns with configurable names, task cards showing priority badge, due date, area badge, comment count. Inline task creation modal. Task detail panel (400px right sidebar). Column management (add, rename, reorder). Team area filter on board.

**Acceptance Criteria:**
- [ ] `GET /api/projects/[projectId]/columns?includeTasks=true` returns columns with nested tasks ordered by position
- [ ] `POST /api/projects/[projectId]/tasks` creates task in specified column
- [ ] `PATCH /api/tasks/[id]` updates task fields
- [ ] `DELETE /api/tasks/[id]` deletes task
- [ ] `PUT /api/tasks/reorder` batch-updates task positions + column_ids (for drag-and-drop)
- [ ] `POST /api/projects/[projectId]/columns` adds a column
- [ ] `PATCH /api/projects/[projectId]/columns/[id]` renames column
- [ ] `DELETE /api/projects/[projectId]/columns/[id]` deletes column (fails if tasks exist → returns 409)
- [ ] `PUT /api/projects/[projectId]/columns/reorder` reorders columns
- [ ] File `src/app/(authenticated)/board/[projectId]/page.tsx` renders `data-testid="kanban-board"`
- [ ] File `src/components/kanban/kanban-board.tsx` renders columns with correct horizontal scroll layout
- [ ] File `src/components/kanban/kanban-column.tsx` renders column header (title + count badge + add button) + droppable card list
- [ ] File `src/components/kanban/kanban-card.tsx` renders title, priority badge, due date, area badge, comment count
- [ ] File `src/components/kanban/task-detail-panel.tsx` renders 400px panel with all task fields + comments section
- [ ] File `src/components/kanban/task-form.tsx` renders create/edit modal with all fields
- [ ] Drag card within same column → updates position (optimistic + API)
- [ ] Drag card across columns → updates column_id + position (optimistic + API)
- [ ] Overdue tasks (due_date < today) have red border on card (CSS class `border-danger`)
- [ ] Filter by team area → board shows only matching tasks; unmatched columns show "No tasks for this area"
- [ ] Empty board shows per-column empty states
- [ ] `data-testid="task-card-{id}"` exists for each visible task

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.5.1 | Create task API routes | `src/app/api/projects/[projectId]/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`, `src/app/api/tasks/reorder/route.ts` | GET tasks (filterable by column_id, area_id, assignee_id), POST create (auto-sets position), PATCH update, DELETE delete. Reorder: batch update with `{ updates: [{id, column_id, position}] }`. Auth + project membership check. | `POST /api/projects/.../tasks` returns task with position |
| 1.5.2 | Create column API routes | `src/app/api/projects/[projectId]/columns/route.ts`, `src/app/api/projects/[projectId]/columns/[columnId]/route.ts`, `src/app/api/projects/[projectId]/columns/reorder/route.ts` | GET columns with optional includeTasks, POST add, PATCH rename, DELETE delete (check for tasks → 409), reorder (accepts `{ orderedIds }`). | `DELETE /api/.../columns/[id]` with tasks returns 409 |
| 1.5.3 | Create fractional indexing utility | `src/lib/reorder.ts` | `getInsertPosition(before, after)` function. Returns midpoint for fractional indexing. `reindexColumns(orderedIds)` returns evenly spaced positions. | `getInsertPosition(null, 100)` returns 50 |
| 1.5.4 | Create useKanban hook | `src/hooks/use-kanban.ts` | `useBoard(projectId)`: fetches columns+tasks. `useColumns(projectId)`: column CRUD mutations. `useMoveTask()`: mutation for reorder with optimistic update + rollback. | Optimistic update rolls back on error |
| 1.5.5 | Create useTasks hook | `src/hooks/use-tasks.ts` | `useTasks(projectId, filters?)`, `useTask(id)`, `useCreateTask()`, `useUpdateTask()`, `useDeleteTask()`. Cache keys invalidate board queries on create/update/delete. | Mutations invalidate `['board', projectId]` |
| 1.5.6 | Build KanbanCard component | `src/components/kanban/kanban-card.tsx` | Draggable card via dnd-kit `useSortable`. Visual: white bg, border, rounded-lg (6px), shadow-sm. Internal spacing 10px. Priority badge top-left. Due date top-right (overdue = red). Title 14px medium, 2-line clamp. Metadata row: area dot+label, comment count icon. Overdue: `border-danger` class. Selected: 2px brand-500 border. | `<KanbanCard task={...} />` renders all fields |
| 1.5.7 | Build KanbanColumn component | `src/components/kanban/kanban-column.tsx` | Droppable via dnd-kit `useDroppable`. Min-width 280px, gap 16px between columns. Header: title + CountBadge + ghost Add button. Cards: 10px gap, vertical list. Column-level empty state when filtered. | `data-testid="kanban-column-{name}"` renders |
| 1.5.8 | Build KanbanBoard component | `src/components/kanban/kanban-board.tsx` | Horizontal scroll layout. Uses `DndContext` + `DragOverlay` for drag-and-drop. Handles: dragStart (create clone), dragEnd (compute new position via `getInsertPosition`, call `useMoveTask`). dndKit sensors: pointer + keyboard. Handle cross-column drops. | Drag card to new column updates column_id |
| 1.5.9 | Build TaskForm component | `src/components/kanban/task-form.tsx` | Modal: title (required), description (textarea), assignee (dropdown from profiles), team area (dropdown from areas, defaults to assignee's area), priority (Low/Medium/High/Urgent radio), due date (date picker). Submit calls useCreateTask or useUpdateTask. | Form validates title required |
| 1.5.10 | Build TaskDetailPanel component | `src/components/kanban/task-detail-panel.tsx` | 400px wide, white bg, border-left, overflow-y-auto. Header: status badge + task ID + close button. Sections: title, description, metadata grid (2-col: assignee+avatar, priority dot, due date, team area, status, project). Action row: "Schedule in Calendar" primary, "Edit" secondary. Comments section (uses Story 1.6 components). | `data-testid="task-detail-panel"` renders |
| 1.5.11 | Build TaskDetailModal (mobile) | `src/components/kanban/task-detail-modal.tsx` | Same content as panel but in a modal. Width 540px, max-width 90vw. Used via media query (max-width: 1023px). | Modal renders on mobile breakpoint |
| 1.5.12 | Build kanban board page | `src/app/(authenticated)/board/[projectId]/page.tsx` | Fetches board data via `useBoard(projectId)`. Renders KanbanBoard. Manages selectedTask state (opens panel/modal). Passes area filter from sidebar context. | `data-testid="kanban-board"` renders |
| 1.5.13 | Wire Supabase Realtime for board | `src/lib/supabase/realtime.ts`, integrated into `useKanban` | Subscribe to `postgres_changes` on `tasks` table filtered by `project_id`. On change: invalidate board query. Cleanup on unmount. | Realtime subscription invalidates query |

---

### Story 1.6 — Comments on Tasks

**Effort:** S (0.5 day)
**Dependencies:** Story 1.5

**Description:** Threaded comments on task detail panel. Comment list with author avatar, name, timestamp, and text. Comment input with auto-expand textarea. API endpoints for CRUD.

**Acceptance Criteria:**
- [ ] `GET /api/tasks/[taskId]/comments` returns comments ordered by created_at ASC
- [ ] `POST /api/tasks/[taskId]/comments` creates comment and returns it
- [ ] `DELETE /api/tasks/[taskId]/comments/[id]` deletes own comment only
- [ ] File `src/components/comments/comment-list.tsx` renders list of comments with `data-testid="comment-list"`
- [ ] File `src/components/comments/comment-item.tsx` renders avatar, author name, timestamp, content, `data-testid="comment-item"`
- [ ] File `src/components/comments/comment-input.tsx` renders textarea + send button, `data-testid="comment-input"`
- [ ] Empty comment → submit button disabled
- [ ] Long comment → textarea auto-expands (min-height 80px, no max)
- [ ] Comment appears immediately via optimistic update
- [ ] `data-testid="comment-count"` on task card shows correct count

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 1.6.1 | Create comment API routes | `src/app/api/tasks/[taskId]/comments/route.ts`, `src/app/api/tasks/[taskId]/comments/[commentId]/route.ts` | GET list (with author profile join), POST create (sets author_id from session), DELETE own comment (check session user matches author_id). Auth check. | `POST /api/tasks/.../comments` returns comment with author |
| 1.6.2 | Create useComments hook | `src/hooks/use-comments.ts` | `useComments(taskId)` query, `useCreateComment()` mutation with optimistic update (add to cache + new comment at bottom), `useDeleteComment()` mutation. | Mutation adds comment to cached list optimistically |
| 1.6.3 | Build CommentItem component | `src/components/comments/comment-item.tsx` | Avatar (28px) + author name (bold, 13px) + timestamp (12px, secondary) on top row. Content below (14px body). Props: `{ comment, isOwn?: boolean }`. Show delete button if isOwn. | `<CommentItem comment={...} />` renders all fields |
| 1.6.4 | Build CommentInput component | `src/components/comments/comment-input.tsx` | Textarea with auto-expand (min-height 80px). Submit button disabled if content empty. Enter to submit (Shift+Enter for newline). Calls `useCreateComment()`. | `data-testid="comment-input"` button disabled when empty |
| 1.6.5 | Build CommentList component | `src/components/comments/comment-list.tsx` | Uses `useComments(taskId)`. Renders list of `<CommentItem>`. CommentInput at bottom. "No comments yet" empty state. Section header "Comments (N)". | `data-testid="comment-list"` renders |

---

## Sprint 2: Calendar + Documents + Polish (3 stories, ~4.5 days)

### Story 2.1 — Google Calendar Integration

**Effort:** M (2 days)
**Dependencies:** Story 1.5

**Description:** Google Calendar OAuth flow, fetch events and display in weekly calendar view, "Schedule in Calendar" from task detail, upcoming tasks panel. Calendar view with day/week toggle, event rendering, task overlay.

**Acceptance Criteria:**
- [ ] File `src/app/(authenticated)/calendar/page.tsx` renders `data-testid="calendar-page"`
- [ ] `GET /api/calendar/auth` returns `{ data: { connected: boolean, email?: string } }`
- [ ] `POST /api/calendar/auth/setup` initiates Google OAuth flow (redirects to Google)
- [ ] `DELETE /api/calendar/auth` revokes and removes stored tokens
- [ ] `GET /api/calendar/events?timeMin=&timeMax=` returns merged Google + local events
- [ ] `POST /api/calendar/schedule` creates event on Google Calendar + stores locally with task_id link
- [ ] `DELETE /api/calendar/events/[id]` deletes event from Google Calendar + local table
- [ ] File `src/components/calendar/calendar-view.tsx` renders week grid with time slots (8am-6pm)
- [ ] File `src/components/calendar/calendar-event.tsx` renders event with left-border color, time, title
- [ ] File `src/components/calendar/schedule-event-modal.tsx` renders modal with date picker, duration, optional project-name toggle
- [ ] File `src/components/calendar/upcoming-tasks-panel.tsx` renders tasks with due dates, priority colors
- [ ] Google Calendar token refresh works: expired token auto-refreshes before API call
- [ ] Task card shows calendar icon indicator when scheduled
- [ ] `data-testid="connect-google-calendar"` renders when not connected

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 2.1.1 | Create Google OAuth helper | `src/lib/google/oauth.ts` | `getValidAccessToken(userId)` — reads from calendar_auth table, checks expiry, refreshes if needed via Google token endpoint. `getAuthUrl()` for initiating OAuth. Store tokens in calendar_auth table. | `getValidAccessToken` returns non-expired token |
| 2.1.2 | Create Google Calendar API client | `src/lib/google/calendar.ts` | `GoogleCalendarClient(accessToken)`. Methods: `fetchEvents(timeMin, timeMax)`, `createEvent({summary, start, end})`, `deleteEvent(googleId)`. Transform Google event shape to internal format. | Client creates valid Google Calendar API request |
| 2.1.3 | Create calendar API routes | `src/app/api/calendar/auth/route.ts`, `src/app/api/calendar/events/route.ts`, `src/app/api/calendar/schedule/route.ts`, `src/app/api/calendar/events/[id]/route.ts` | Auth: GET status, DELETE revoke. Events: GET (merge Google + local calendar_events). Schedule: POST (create on Google + store locally). Delete: DELETE (from Google + local). | `POST /api/calendar/schedule` creates event |
| 2.1.4 | Create useCalendar hook | `src/hooks/use-calendar.ts` | `useCalendarAuth()` — status. `useCalendarEvents(timeMin, timeMax)` — merged list. `useScheduleEvent()` — mutation. `useCalendarAuth()` — connect/disconnect. | Hook exports expected query/mutation functions |
| 2.1.5 | Build CalendarEvent component | `src/components/calendar/calendar-event.tsx` | White bg, left border 3px (brand-500 or area color), padding 8px/12px, rounded. Time: 12px secondary mono. Title: 13px. Task link icon right side. Props: `{ event, onClick }`. | `<CalendarEvent event={...} />` renders with left border |
| 2.1.6 | Build CalendarView component | `src/components/calendar/calendar-view.tsx` | Week grid (Mon-Sun columns, 8am-6pm rows). Uses useCalendarEvents for current range. CalendarEvent positioned in correct time slot. Navigation: `< prev | Jul 27 - Aug 2 | next >`. View toggle: Day/Week. | `data-testid="calendar-view"` renders grid |
| 2.1.7 | Build ScheduleEventModal | `src/components/calendar/schedule-event-modal.tsx` | Opens from task detail "Schedule in Calendar". Pre-fills task title as event title, due date as date. Duration picker (default 1h). Toggle to include project name. Calls useScheduleEvent. On success: task card shows calendar icon. | Modal pre-fills task title |
| 2.1.8 | Build UpcomingTasksPanel | `src/components/calendar/upcoming-tasks-panel.tsx` | Side panel showing tasks with due dates. Sorted by due date ASC. Color-coded left border by priority (red=urgent, amber=high, etc.). Completed tasks show checkmark. | Panel shows tasks sorted by due date |
| 2.1.9 | Build calendar page | `src/app/(authenticated)/calendar/page.tsx` | Connect Google Calendar button (if not connected). CalendarView + UpcomingTasksPanel side-by-side. Top bar: "Calendar" title + view toggle + date navigation. | `data-testid="calendar-page"` renders |

---

### Story 2.2 — Documents CRUD + Markdown Editor

**Effort:** M (1.5 days)
**Dependencies:** Story 1.4

**Description:** Document CRUD with in-browser markdown editor (split pane). Document list page with project filter tabs. Create, view, edit .md documents. Project-linking optional per document.

**Acceptance Criteria:**
- [ ] `GET /api/documents?project_id=X` returns filtered document list
- [ ] `POST /api/documents` creates document with title, content, optional project_id
- [ ] `PATCH /api/documents/[id]` updates title, content
- [ ] `DELETE /api/documents/[id]` deletes document
- [ ] File `src/app/(authenticated)/documents/page.tsx` renders `data-testid="documents-page"`
- [ ] File `src/app/(authenticated)/documents/[documentId]/page.tsx` renders `data-testid="document-editor-page"`
- [ ] File `src/components/documents/document-list.tsx` renders list with project filter tabs, `data-testid="document-list"`
- [ ] File `src/components/documents/document-row.tsx` renders file icon, title, metadata (type + date + project), `data-testid="document-row"`
- [ ] File `src/components/documents/document-editor.tsx` renders split pane with CodeMirror editor left + react-markdown preview right
- [ ] File `src/components/documents/markdown-preview.tsx` renders markdown content via react-markdown with remark-gfm
- [ ] Editor toolbar has save button that calls PATCH API
- [ ] Split pane toggles: Edit only / Preview only / Split
- [ ] Back button navigates to document list
- [ ] "Link to Project" dropdown in editor toolbar populates from useProjects
- [ ] Empty document list shows "No documents yet" state
- [ ] `npm run build` exits 0

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 2.2.1 | Create document API routes | `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts` | GET list (filterable by project_id), POST create, PATCH update (title, content), DELETE delete. Auth check. | `POST /api/documents` creates document |
| 2.2.2 | Create useDocuments hook | `src/hooks/use-documents.ts` | `useDocuments(projectId?)`, `useDocument(id)`, `useCreateDocument()`, `useUpdateDocument()`, `useDeleteDocument()`. Debounced auto-save logic (3s after last change). | Auto-save fires after 3s of inactivity |
| 2.2.3 | Build DocumentRow component | `src/components/documents/document-row.tsx` | White bg, border-bottom, padding 14px/20px. File icon, title 14px medium, metadata row (12px secondary: `.md`, updated date, project name badge). Hover: bg page-alt. | `<DocumentRow doc={...} />` renders metadata |
| 2.2.4 | Build DocumentList component | `src/components/documents/document-list.tsx` | Project filter tabs ("All Documents", then each project as tab). Uses useDocuments. List of DocumentRow. "+ New Document" button. Empty state. | `data-testid="document-list"` renders tabs + rows |
| 2.2.5 | Build MarkdownPreview component | `src/components/documents/markdown-preview.tsx` | Uses react-markdown + remark-gfm + rehype-highlight. Prose styling via Tailwind typography (or custom). Syntax highlighting for code blocks. | `<MarkdownPreview content="# Hello" />` renders `<h1>Hello</h1>` |
| 2.2.6 | Build DocumentEditor component | `src/components/documents/document-editor.tsx` | DocumentTitleInput (18px semibold). Toolbar: save button, view toggle (Edit/Preview/Split), Link to Project dropdown. Split pane: @uiw/react-md-editor left, MarkdownPreview right. Auto-save with useDebounce (3s). Load document content on mount. | Split pane shows editor + preview side-by-side |
| 2.2.7 | Build documents list page | `src/app/(authenticated)/documents/page.tsx` | Top bar: "Documents" + filter dropdown + "+ New Doc" button. Content: DocumentList. Click row → navigate to `/documents/[id]`. | `data-testid="documents-page"` renders |
| 2.2.8 | Build document editor page | `src/app/(authenticated)/documents/[documentId]/page.tsx` | Top bar: back arrow + doc title + save button + ProjectLinkDropdown. Content: DocumentEditor with loaded document. Handles create new (no id) vs edit (with id). | `data-testid="document-editor-page"` renders |

---

### Story 2.3 — Polish, Edge Cases, Responsive

**Effort:** S (1 day)
**Dependencies:** All above stories

**Description:** Final polish pass: empty states on every screen, error boundaries, loading skeletons, responsive behavior at tablet/mobile breakpoints, edge case handling for all user flows, data-testid audit, keyboard accessibility, toast notifications for mutations.

**Acceptance Criteria:**
- [ ] Every list screen has an empty state component with CTA button
- [ ] Every mutation (create/update/delete) shows success toast or error toast
- [ ] `<ErrorBoundary>` wraps each route page
- [ ] Sidebar collapses to icon-only (64px) at tablet breakpoint (max-width: 1024px)
- [ ] Sidebar hidden with hamburger toggle at mobile breakpoint (max-width: 640px)
- [ ] Kanban horizontally scrolls on tablet (1.5 columns visible)
- [ ] Calendar shows day-only view on mobile (<640px)
- [ ] Document editor stacks (top editor, bottom preview) on tablet
- [ ] Task detail shows as modal instead of panel on mobile
- [ ] All buttons have `min-h-[44px]` on mobile touch targets
- [ ] All animations respect `prefers-reduced-motion` (`motion-safe:` prefix in Tailwind)
- [ ] Keyboard navigation works: Tab through sidebar nav items, Enter activates, Escape closes modals
- [ ] Focus-visible ring (2px brand-500) on all interactive elements
- [ ] All icons have `aria-hidden="true"` (decorative) or `aria-label` (informative)
- [ ] Loading skeletons shown while data fetches (not just spinners)
- [ ] Network failure → toast with retry, form state preserved
- [ ] `npm run build` exits 0 with no warnings

**Tasks:**

| # | Task | Files | Implementation Notes | Test Requirement |
|---|------|-------|---------------------|------------------|
| 2.3.1 | Add empty states to all screens | Various pages | Every list page (projects, documents, tasks, comments, calendar, areas) must have `<EmptyState>` when data length = 0. | EmptyState renders on each page with zero data |
| 2.3.2 | Add error boundaries | `src/app/(authenticated)/layout.tsx` + each page | Wrap each route page in `<ErrorBoundary>`. Add `error.tsx` files for route groups. | Error boundary catches thrown errors |
| 2.3.3 | Add toast notifications | All mutation hooks | Use shadcn toast. Call `toast.success()` or `toast.error()` on mutation settle. Network failure → toast with retry button. | Mutation failure shows toast |
| 2.3.4 | Implement responsive sidebar | `src/components/layout/sidebar.tsx` | Use `useMediaQuery` hook. Tablet (640-1023px): `w-16` icon-only, text hidden. Mobile (<640): hidden, drawer overlay via hamburger. | Sidebar collapses on tablet |
| 2.3.5 | Implement responsive kanban | `src/components/kanban/kanban-board.tsx` | Tablet: horizontal scroll with snap points. Mobile: single column with swipe controls. | Board scrolls on small screens |
| 2.3.6 | Implement responsive calendar | `src/components/calendar/calendar-view.tsx` | Mobile: day-only view. Tablet: 3-day view. Desktop: full week. | Calendar switches to day view on mobile |
| 2.3.7 | Implement responsive editor | `src/components/documents/document-editor.tsx` | Tablet: stacked layout (editor top, preview bottom). Mobile: tab toggle (Edit/Preview). | Editor stacks on tablet |
| 2.3.8 | Implement responsive task detail | `src/components/kanban/task-detail-panel.tsx` | Mobile: use TaskDetailModal instead of panel (full-screen modal). Tablet: use modal (540px). | Panel replaced by modal on mobile |
| 2.3.9 | Add touch targets | All interactive components | Mobile buttons: `min-h-[44px]`. Desktop: `min-h-[32px]`. Update button variants. | Interactive elements meet min-height |
| 2.3.10 | Add reduced motion support | `tailwind.config.ts` + animations | Use `motion-safe:transition-*` or `@media (prefers-reduced-motion: reduce)` CSS. Wrap animations in `motion-safe:` variants. | `prefers-reduced-motion` disables transitions |
| 2.3.11 | Add keyboard navigation | Sidebar, modals, kanban, dropdowns | Tab order: skip to content → primary action → nav → search → content. Escape closes all modals/panels. Arrow keys for dropdowns. Focus-visible rings. | Tab through sidebar nav items works |
| 2.3.12 | Add ARIA attributes | All components | Per handoff-design.md §6.4: sidebar = `<nav aria-label="Main navigation">`, kanban = `role="list"`, draggable cards = `role="button" aria-grabbed`, modals = `role="dialog" aria-modal="true"`. | Components have correct ARIA roles |
| 2.3.13 | Add loading skeletons | All data-fetching pages | Replace plain spinners with skeleton components matching card/list shapes. Uses `<LoadingState>` or custom skeleton per screen. | Loading state shows skeleton shape |
| 2.3.14 | Form state persistence | `src/components/kanban/task-form.tsx`, etc. | On network failure: keep modal open, preserve form values, show error toast with retry. | Form values survive failed submission |
| 2.3.15 | Final build check | `npm run build` | Run production build, fix any TS errors or lint warnings. Verify all routes render. | `npm run build` exits 0 |

---

## Dependency Graph

```
Story 1.1 (Scaffold)
  └── Story 1.2 (Auth + Layout)
        ├── Story 1.3 (Areas)
        │     └── Story 1.4 (Projects)
        │           ├── Story 1.5 (Kanban + Tasks)
        │           │     ├── Story 1.6 (Comments)
        │           │     └── Story 2.1 (Calendar)
        │           └── Story 2.2 (Documents)
        └── Story 2.3 (Polish) — depends on all stories above
```

**Parallelization:** Stories 1.6 (Comments) can be done in parallel with Story 2.1 (Calendar) after 1.5 is complete. Story 2.2 (Documents) depends on 1.4 (Projects) but not on 1.5 (Kanban), so it can start earlier.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prisma cold start on Vercel serverless | High | Medium | Use `@prisma/extension-accelerate` or move to Node VPS if latency > 1s |
| Google Calendar OAuth token expiry | Medium | Low | Auto-refresh in `getValidAccessToken()`, popup re-auth on refresh failure |
| Drag-and-drop cross-column logic complexity | Medium | High | Prototype with static mock data first; dnd-kit has well-documented cross-container examples |
| Free tier Supabase pauses after 7d inactivity | High | Medium | Set up Vercel cron job to ping DB daily |
| Single-user MVP limits real-time testing | Low | Low | Test real-time with two browser tabs; same user session works |

---

## Effort Summary

| Story | Effort | Days |
|-------|--------|------|
| 1.1 Scaffold | M | 2.0 |
| 1.2 Auth + Layout | M | 1.5 |
| 1.3 Areas | S | 1.0 |
| 1.4 Projects | S | 1.0 |
| 1.5 Kanban + Tasks | L | 2.5 |
| 1.6 Comments | S | 0.5 |
| **Sprint 1 Total** | | **8.5** |
| 2.1 Calendar | M | 2.0 |
| 2.2 Documents | M | 1.5 |
| 2.3 Polish | S | 1.0 |
| **Sprint 2 Total** | | **4.5** |
| **Grand Total** | | **~13 days** |

*Note: Effort assumes a single developer. Sprint 1 (8.5 days) exceeds the 5-10 story/5-10 day heuristic slightly because stories 1.1 and 1.5 are large. If tighter sprints are needed, split Story 1.5 into "Kanban Board Shell" (columns + display) and "Task CRUD + DnD".*
