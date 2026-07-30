# SeOrganize+ Operations Cockpit and Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Hoje cockpit, Quick Capture, personal views,
recurrence, notifications, mentions and activity feed while correcting
document, calendar, DnD and global-project regressions.

**Architecture:** Shared domain helpers create activity and notification rows
inside Prisma transactions. Hoje composes focused task, calendar, activity and
notification queries. Global project state is removed; Board owns selection
locally and reuses the same DnD board primitive in single and all-project
views.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma/PostgreSQL,
Supabase Auth, TanStack Query, dnd-kit, Radix/shadcn, Motion, React Markdown,
Vitest.

**Execution constraints:** Work on `feat/seorganizeb2b-wave5`. Preserve
pre-existing dirty changes. Do not apply destructive migrations, commit, push
or create a PR without a separate explicit authorization.

---

## File Responsibility Map

### Domain

- `src/lib/activity/types.ts`: activity and notification type contracts.
- `src/lib/activity/record.ts`: transactional activity/notification writes.
- `src/lib/mentions.ts`: canonical mention extraction and display parsing.
- `src/lib/recurrence.ts`: pure recurrence date calculation.
- `src/lib/calendar/conflicts.ts`: normalized overlap calculation.

### Persistence

- `prisma/schema.prisma`: Activity, Notification, CommentMention, SavedView,
  recurrence fields and completion columns.
- `prisma/migrations/20260730110000_operations_cockpit/migration.sql`: additive
  collaboration tables and recurrence flags.

### APIs

- `src/app/api/notifications/route.ts`: list and mark-all-read.
- `src/app/api/notifications/[id]/route.ts`: mark one read.
- `src/app/api/activity/route.ts`: current-user or task timeline.
- `src/app/api/today/tasks/route.ts`: assigned overdue/today tasks.
- `src/app/api/saved-views/route.ts`: list/create personal views.
- `src/app/api/saved-views/[id]/route.ts`: owned-view deletion.
- `src/app/api/calendar/conflicts/route.ts`: overlap preflight.

### UI and state

- `src/app/(authenticated)/page.tsx`: Hoje cockpit.
- `src/components/today/*`: cockpit sections.
- `src/components/notifications/notification-center.tsx`: topbar bell/panel.
- `src/components/activity/activity-feed.tsx`: recent and task-scoped feed.
- `src/components/quick-capture/*`: global capture dialog/provider.
- `src/components/comments/comment-input.tsx`: mention autocomplete.
- `src/components/comments/comment-item.tsx`: mention rendering.
- `src/components/board/saved-view-control.tsx`: personal views.

---

### Task 1: Lock Regression Contracts

**Files:**
- Create: `src/__tests__/manual-validation-regressions.test.ts`
- Modify: `src/__tests__/story-1.4.test.ts`

- [ ] **Step 1: Write failing source-contract tests**

Assert:

```ts
expect(animatedPage).toContain('className="h-full min-h-0"');
expect(calendarPage).not.toContain('min-h-[760px]');
expect(boardPage).toContain("<KanbanBoard");
expect(sidebar).not.toContain("ProjectSelector");
expect(layout).not.toContain("ProjectProvider");
expect(appLayout).not.toContain("lastProjectId");
expect(markdownPreview).toContain("remarkBreaks");
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run src/__tests__/manual-validation-regressions.test.ts
```

Expected: failures for every current regression.

- [ ] **Step 3: Update obsolete story contract**

`story-1.4.test.ts` must keep Project APIs/components covered but assert the
selector is not mounted in the sidebar.

---

### Task 2: Add Collaboration and Recurrence Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260730110000_operations_cockpit/migration.sql`
- Create: `src/__tests__/operations-schema.test.ts`

- [ ] **Step 1: Write schema contract tests**

Cover `Activity`, `Notification`, `CommentMention`, `SavedView`,
`recurrenceType`, `recurrenceGeneratedAt` and `completesTasks`.

- [ ] **Step 2: Run red test**

```bash
npx vitest run src/__tests__/operations-schema.test.ts
```

- [ ] **Step 3: Add Prisma models and relations**

Use explicit map names, cascade mention/notification records, set nullable
activity task/actor relations to null on deletion, and add ownership indexes.

- [ ] **Step 4: Create additive SQL**

The migration creates all four tables, adds recurrence/completion columns and
backfills completion columns:

```sql
UPDATE "project_columns"
SET "completes_tasks" = true
WHERE lower(unaccent("name")) IN ('done', 'concluido', 'concluida', 'finalizado');
```

Avoid the `unaccent` extension dependency by implementing equivalent explicit
lowercase comparisons in final SQL.

- [ ] **Step 5: Validate without applying**

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx vitest run src/__tests__/operations-schema.test.ts
```

---

### Task 3: Implement Pure Domain Helpers

**Files:**
- Create: `src/lib/mentions.ts`
- Create: `src/lib/recurrence.ts`
- Create: `src/lib/calendar/conflicts.ts`
- Create: `src/__tests__/operations-domain.test.ts`

- [ ] **Step 1: Write failing unit tests**

Cover:

- `@[Ana](profile-1)` extraction and deduplication;
- invalid token rejection;
- daily, weekly and end-of-month recurrence;
- interval greater than one;
- overlap and boundary-touch semantics.

- [ ] **Step 2: Run red**

```bash
npx vitest run src/__tests__/operations-domain.test.ts
```

- [ ] **Step 3: Implement pure helpers**

```ts
export function extractMentionProfileIds(content: string): string[];
export function stripMentionMarkup(content: string): string;
export function nextRecurrenceDate(
  base: Date,
  type: "daily" | "weekly" | "monthly",
  interval: number,
): Date;
export function eventsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean;
```

- [ ] **Step 4: Run green**

```bash
npx vitest run src/__tests__/operations-domain.test.ts
```

---

### Task 4: Add Transactional Activity and Notifications

**Files:**
- Create: `src/lib/activity/types.ts`
- Create: `src/lib/activity/record.ts`
- Create: `src/app/api/activity/route.ts`
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/route.ts`
- Create: `src/hooks/use-notifications.ts`
- Create: `src/hooks/use-activity.ts`
- Create: `src/__tests__/activity-notification.test.ts`

- [ ] **Step 1: Write API/source contracts**

Assert ownership predicates, 30-second polling, unread count, single-read and
mark-all-read mutations.

- [ ] **Step 2: Implement recorder**

```ts
await recordActivity(tx, {
  actorId,
  taskId,
  type,
  entityType,
  entityId,
  summary,
  metadata,
  notifyProfileIds,
});
```

Deduplicate recipients and exclude the actor.

- [ ] **Step 3: Implement authenticated APIs**

Task-scoped activity validates task existence. Global activity returns actions
where the user is actor, assignee or notification recipient.

- [ ] **Step 4: Implement hooks**

Notifications use:

```ts
refetchInterval: 30_000
```

Mutations update cache before refetch.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run src/__tests__/activity-notification.test.ts
```

---

### Task 5: Add Mentions to Task Comments

**Files:**
- Modify: `src/app/api/tasks/[taskId]/comments/route.ts`
- Modify: `src/components/comments/comment-input.tsx`
- Modify: `src/components/comments/comment-item.tsx`
- Modify: `src/hooks/use-comments.ts`
- Create: `src/__tests__/comment-mentions.test.ts`

- [ ] **Step 1: Write failing mention contracts**

Assert canonical token insertion, server extraction, profile validation,
`CommentMention` creation and notification activity.

- [ ] **Step 2: Implement autocomplete**

When the text before the caret matches `/@([\w.-]*)$/`, show matching profiles.
Selection replaces the query with `@[Name](id) `.

- [ ] **Step 3: Implement transactional comment creation**

Create comment, mentions, activity and notifications in one Prisma transaction.
Return the comment with `mentions.profile`.

- [ ] **Step 4: Render mentions**

Render canonical tokens as styled `@Name` spans while preserving surrounding
text.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/__tests__/comment-mentions.test.ts
```

---

### Task 6: Make Recurrence Idempotent

**Files:**
- Modify: `src/app/api/tasks/[taskId]/route.ts`
- Modify: `src/app/api/projects/[projectId]/tasks/route.ts`
- Modify: `src/components/kanban/task-form.tsx`
- Modify: `src/hooks/use-kanban.ts`
- Modify: `src/hooks/use-tasks.ts`
- Create: `src/lib/tasks/complete-recurring-task.ts`
- Create: `src/__tests__/task-recurrence.test.ts`

- [ ] **Step 1: Write failing recurrence tests**

Cover completion transition, non-completion movement, duplicate completion,
assignee copying and next incomplete column selection.

- [ ] **Step 2: Accept recurrence fields**

Task create/update accepts `recurrenceType` and `recurrenceInterval`. Validate
type and interval `1..365`.

- [ ] **Step 3: Generate on transition**

Before update, load source and target columns. Only call the recurrence helper
when `source.completesTasks === false` and
`target.completesTasks === true`.

Claim with:

```ts
const claimed = await tx.task.updateMany({
  where: { id: task.id, recurrenceGeneratedAt: null },
  data: { recurrenceGeneratedAt: new Date() },
});
```

Create the next task only when `claimed.count === 1`.

- [ ] **Step 4: Add recurrence UI**

Task form exposes None, Daily, Weekly and Monthly plus interval. Cards show a
small repeat icon.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/__tests__/task-recurrence.test.ts
```

---

### Task 7: Correct Layouts and Global Project Influence

**Files:**
- Modify: `src/components/shared/animated-page.tsx`
- Modify: `src/app/(authenticated)/documents/[documentId]/page.tsx`
- Modify: `src/components/documents/document-editor.tsx`
- Modify: `src/components/documents/markdown-preview.tsx`
- Modify: `src/app/(authenticated)/calendar/page.tsx`
- Modify: `src/components/calendar/calendar-view.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/app-layout.tsx`
- Modify: `src/app/(authenticated)/layout.tsx`
- Modify: `src/app/(authenticated)/board/page.tsx`
- Modify: `src/components/documents/document-list.tsx`
- Delete: `src/stores/project-context.tsx`
- Delete: `src/components/projects/project-selector.tsx`

- [ ] **Step 1: Add `remark-breaks`**

```bash
npm install remark-breaks
```

- [ ] **Step 2: Establish full-height flex boundaries**

`AnimatedPage`, document page/editor and calendar page use `h-full min-h-0`.
Remove calendar’s fixed minimum height.

- [ ] **Step 3: Enable Markdown soft breaks**

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  rehypePlugins={[rehypeHighlight]}
>
```

- [ ] **Step 4: Remove global project influence**

Remove the sidebar nav item and selector, provider wrapper and remembered
project routing. Board defaults to `__all__` and retains local URL selection.
Document list owns its optional project filter locally.

- [ ] **Step 5: Run regression tests**

```bash
npx vitest run src/__tests__/manual-validation-regressions.test.ts src/__tests__/story-1.4.test.ts src/__tests__/story-2.2.test.ts
```

---

### Task 8: Enable DnD in All Projects

**Files:**
- Modify: `src/components/kanban/kanban-board.tsx`
- Modify: `src/components/kanban/kanban-column.tsx`
- Modify: `src/app/(authenticated)/board/page.tsx`
- Create: `src/__tests__/all-projects-dnd.test.ts`

- [ ] **Step 1: Write failing DnD source contract**

Assert `ProjectBoardSection` renders `KanbanBoard` and passes a compact,
no-column-management mode.

- [ ] **Step 2: Add presentation options**

`KanbanBoard` accepts:

```ts
mode?: "full" | "compact";
projectName?: string;
allowColumnManagement?: boolean;
```

DnD behavior remains identical. Compact mode hides add/rename/delete column
controls.

- [ ] **Step 3: Replace static cards**

Each All Projects section renders one independent `KanbanBoard`; this naturally
prevents cross-project dropping.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/all-projects-dnd.test.ts src/__tests__/story-1.5.test.ts
```

---

### Task 9: Build Hoje

**Files:**
- Replace: `src/app/(authenticated)/page.tsx`
- Create: `src/app/api/today/tasks/route.ts`
- Create: `src/hooks/use-today.ts`
- Create: `src/components/today/today-tasks.tsx`
- Create: `src/components/today/today-agenda.tsx`
- Create: `src/components/today/today-activity.tsx`
- Create: `src/__tests__/today-cockpit.test.ts`

- [ ] **Step 1: Write failing cockpit contracts**

Cover route presence, assigned-task predicate, overdue/today boundary, calendar
hook, activity hook and sidebar Today item.

- [ ] **Step 2: Implement task endpoint**

Return non-archived tasks assigned to the current user with `dueDate <= end of
today`, project, area and assignees.

- [ ] **Step 3: Implement responsive cockpit**

Use existing calendar query for today, activity query and notification unread
count. Each panel owns its state and retry.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/today-cockpit.test.ts
```

---

### Task 10: Add Notification Center and Activity Timeline

**Files:**
- Create: `src/components/notifications/notification-center.tsx`
- Create: `src/components/activity/activity-feed.tsx`
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/components/kanban/task-detail-panel.tsx`
- Modify: `src/components/kanban/task-detail-modal.tsx`

- [ ] **Step 1: Mount topbar center**

Bell renders unread badge and Popover list. Clicking a notification marks it
read then routes to its entity.

- [ ] **Step 2: Add task timeline**

Task detail displays `ActivityFeed taskId={task.id}` below comments.

- [ ] **Step 3: Add accessibility**

Use `aria-live="polite"`, labelled unread counts, keyboard controls and 44px
mobile targets.

- [ ] **Step 4: Run focused tests**

```bash
npx vitest run src/__tests__/activity-notification.test.ts src/__tests__/today-cockpit.test.ts
```

---

### Task 11: Add Quick Capture

**Files:**
- Create: `src/stores/quick-capture-context.tsx`
- Create: `src/components/quick-capture/quick-capture-dialog.tsx`
- Create: `src/hooks/use-quick-capture.ts`
- Modify: `src/app/(authenticated)/layout.tsx`
- Modify: `src/components/layout/app-layout.tsx`
- Modify: `src/components/layout/topbar.tsx`
- Create: `src/__tests__/quick-capture.test.ts`

- [ ] **Step 1: Write keyboard/action contracts**

Assert provider mount, `metaKey || ctrlKey`, key `k`, three entity choices and
reuse of schedule dialog.

- [ ] **Step 2: Implement provider**

Global listener ignores editable inputs and opens the dialog elsewhere.

- [ ] **Step 3: Implement Task capture**

Project select plus title. Fetch first non-complete column, create task, toast
success and route to task board.

- [ ] **Step 4: Implement Event and Document capture**

Event delegates to `openScheduleEvent`. Document creates then routes.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/__tests__/quick-capture.test.ts
```

---

### Task 12: Add Personal Saved Views

**Files:**
- Create: `src/app/api/saved-views/route.ts`
- Create: `src/app/api/saved-views/[id]/route.ts`
- Create: `src/hooks/use-saved-views.ts`
- Create: `src/components/board/saved-view-control.tsx`
- Modify: `src/app/(authenticated)/board/page.tsx`
- Create: `src/__tests__/saved-views.test.ts`

- [ ] **Step 1: Write ownership contracts**

Assert every query and mutation uses `userId: session.user.id`.

- [ ] **Step 2: Implement API**

Validate names, scope `board`, JSON filters and ownership. Return
`FORBIDDEN/NOT_FOUND` without leaking another user’s data.

- [ ] **Step 3: Implement Board control**

Save current project/area/filter query state, apply a selected view and delete
owned views.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/saved-views.test.ts
```

---

### Task 13: Add Non-Blocking Calendar Conflict Warnings

**Files:**
- Create: `src/app/api/calendar/conflicts/route.ts`
- Create: `src/hooks/use-calendar-conflicts.ts`
- Modify: `src/components/calendar/schedule-event-modal.tsx`
- Create: `src/__tests__/calendar-conflicts.test.ts`

- [ ] **Step 1: Write failing contracts**

Cover local overlap, Google normalized overlap, deduplication, boundary touch
and creation continuation.

- [ ] **Step 2: Implement preflight API**

Reuse Google token/client and normalized event functions. Return conflicts and
a `googleStatus` field. Do not treat unavailable Google as zero conflicts.

- [ ] **Step 3: Add dialog warning**

First submit checks conflicts. When present, preserve form and show list with
Cancel and Create Anyway. Second confirmation performs the existing mutation.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/calendar-conflicts.test.ts src/__tests__/calendar-domain.test.ts
```

---

### Task 14: Instrument Core Activity Writes

**Files:**
- Modify: `src/app/api/projects/[projectId]/tasks/route.ts`
- Modify: `src/app/api/tasks/[taskId]/route.ts`
- Modify: `src/app/api/calendar/schedule/route.ts`
- Modify: `src/app/api/tasks/[taskId]/comments/route.ts`
- Modify: relevant task/delete/comment routes

- [ ] **Step 1: Add activity to successful mutations**

Record task creation, movement, assignment change, archive/delete, comment,
mention, event scheduling and recurrence generation.

- [ ] **Step 2: Select recipients**

Assignments notify added assignees. Mentions notify mentioned profiles.
Scheduling activity notifies internal attendees. Exclude actor.

- [ ] **Step 3: Verify transaction boundaries**

No mutation may return success when its required Activity record fails.

- [ ] **Step 4: Run activity tests**

```bash
npx vitest run src/__tests__/activity-notification.test.ts src/__tests__/comment-mentions.test.ts src/__tests__/task-recurrence.test.ts
```

---

### Task 15: Complete Automated Verification

**Files:**
- Modify only defects found by verification.

- [ ] **Step 1: Run focused suite**

```bash
npx vitest run \
  src/__tests__/manual-validation-regressions.test.ts \
  src/__tests__/operations-schema.test.ts \
  src/__tests__/operations-domain.test.ts \
  src/__tests__/activity-notification.test.ts \
  src/__tests__/comment-mentions.test.ts \
  src/__tests__/task-recurrence.test.ts \
  src/__tests__/all-projects-dnd.test.ts \
  src/__tests__/today-cockpit.test.ts \
  src/__tests__/quick-capture.test.ts \
  src/__tests__/saved-views.test.ts \
  src/__tests__/calendar-conflicts.test.ts
```

- [ ] **Step 2: Run full gates**

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npx prisma format
npx prisma validate
npx prisma generate
npm run build
git diff --check
```

- [ ] **Step 3: Record limitations**

Do not apply migrations while local Supabase is offline. Hand off manual checks
for DnD, editor height/breaks, calendar viewport/conflicts, multiuser
notifications/mentions, recurrence and Google sync.

- [ ] **Step 4: Prepare commit summary**

Review `git status`, `git diff --stat` and `git diff`. Request explicit commit
approval; do not commit automatically.
