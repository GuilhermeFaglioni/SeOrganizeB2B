# SeOrganize+ Operations Cockpit and Collaboration Design

**Date:** 2026-07-30  
**Status:** Approved in conversation  
**Visual direction:** Executive Quartz  
**Visual flow:** `.superpowers/brainstorm/92203-1785388495/content/operations-wave-visual-flow.html`

## 1. Objective

This wave turns SeOrganize+ into a daily operations cockpit while correcting
the document, calendar and global-board regressions found during manual
validation.

The wave delivers:

- a `Hoje` cockpit as the authenticated landing page;
- structured global Quick Capture through `⌘K`;
- personal saved views;
- recurring tasks whose next occurrence is created on completion;
- in-app notifications with 30-second polling;
- task-comment mentions;
- an activity feed on `Hoje` and task timelines;
- non-blocking calendar-conflict warnings;
- full-height document and calendar layouts;
- drag and drop inside each project section of `All Projects`;
- removal of the global project selector, provider and remembered-project
  routing;
- Markdown soft breaks so one editor line break renders as one preview line
  break.

## 2. Approved Product Decisions

### 2.1 Projects

Projects remain a domain entity and continue organizing tasks, columns and
optional document associations. The product removes their global influence:

- no `Projects` navigation item;
- no sidebar project selector;
- no `ProjectProvider`;
- no `lastProjectId` local storage;
- no automatic routing based on a remembered project.

The Board owns project selection locally. `All Projects` is the default board
view.

### 2.2 Daily cockpit

`/` renders `Hoje` and becomes the first sidebar item. It shows:

- tasks assigned to the current user that are overdue or due today;
- today’s calendar events;
- unread-notification count;
- recent activity;
- shortcuts to personal saved views.

Each section has loading, error, empty and populated states.

### 2.3 Quick Capture

`⌘K` or the contextual capture action opens one structured dialog. Users choose
Task, Event or Document:

- Task: title and project; task is created in the project’s first non-complete
  column.
- Event: delegates to the existing schedule dialog.
- Document: creates an untitled document and opens the editor.

Quick Capture does not parse natural language in this wave.

### 2.4 Recurring tasks

Supported cadences are daily, weekly and monthly with an integer interval.
When a recurring task transitions from an incomplete column into a completion
column, the application creates exactly one next occurrence.

The next task preserves:

- title and description;
- project, area and priority;
- assignees;
- recurrence settings.

The next due date is calculated from the completed task’s due date, falling
back to the completion date. A conditional database claim on the source task
prevents duplicate generation.

Columns have an explicit `completesTasks` flag. The migration marks existing
`Done`, `Concluído`, `Concluída` and `Finalizado` columns as completion columns.

### 2.5 Saved views

Saved views are personal. A view stores:

- scope;
- name;
- project selection;
- area filters;
- temporal/assignment filter.

Board controls can apply, create and delete views. Shared views are out of
scope.

### 2.6 Notifications, mentions and activity

`Activity` is the immutable operational log. It records task creation, update,
movement, assignment, comments, mentions, scheduling and recurrence creation.

`Notification` references one activity and one recipient. The topbar bell:

- polls every 30 seconds;
- shows unread count;
- opens a panel;
- marks one or all notifications read;
- navigates to the related entity.

Mentions are supported only in task comments. The editor inserts canonical
tokens:

```text
@[Display Name](profile-id)
```

The API extracts IDs, validates profiles, creates `CommentMention` rows and
notifies every mentioned profile except the author.

Task detail shows an activity timeline. `Hoje` shows recent activity relevant
to the current user.

### 2.7 Calendar conflicts

Before creating an event, the client checks normalized Google and local events
with overlap semantics:

```text
event.start < proposed.end AND event.end > proposed.start
```

Conflicts produce a visible warning listing overlapping events. The warning
never blocks creation. Users explicitly choose “Create anyway”.

### 2.8 Layout corrections

Authenticated shell height is exactly the viewport below no outer document
scroll.

- `AnimatedPage` establishes `height: 100%`.
- Document editor uses `min-height: 0` through every flex boundary.
- Calendar removes the fixed 760px minimum.
- Calendar grid and upcoming-task rail own their internal scrolling.
- `All Projects` renders each project through the same DnD-enabled Kanban
  primitive as a single project. DnD cannot cross project-section boundaries.

### 2.9 Markdown preview

The current `breaks` option passed to `remark-gfm` is ineffective. Add
`remark-breaks` so one soft line break in the editor becomes one `<br>` in
preview. A blank visual line therefore requires one blank editor line, not two.

## 3. Data Model

### 3.1 Activity

```prisma
model Activity {
  id         String   @id @default(uuid())
  actorId    String?
  taskId     String?
  type       String
  entityType String
  entityId   String
  summary    String
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

Task deletion sets the optional task relation to null; audit text and entity ID
remain.

### 3.2 Notification

```prisma
model Notification {
  id          String    @id @default(uuid())
  recipientId String
  activityId  String
  readAt      DateTime?
  createdAt   DateTime  @default(now())

  @@unique([recipientId, activityId])
}
```

### 3.3 CommentMention

```prisma
model CommentMention {
  commentId String
  profileId String
  createdAt DateTime @default(now())

  @@id([commentId, profileId])
}
```

### 3.4 SavedView

```prisma
model SavedView {
  id        String   @id @default(uuid())
  userId    String
  name      String
  scope     String
  filters   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, scope, name])
}
```

### 3.5 Recurrence

`Task` receives:

- `recurrenceType`;
- `recurrenceInterval`;
- `recurrenceSeriesId`;
- `recurrenceGeneratedAt`.

`ProjectColumn` receives `completesTasks`.

## 4. API Surface

- `GET /api/today/tasks`
- `GET /api/activity?taskId=<id>&limit=<n>`
- `GET /api/notifications`
- `PATCH /api/notifications`
- `PATCH /api/notifications/[id]`
- `GET|POST /api/saved-views`
- `DELETE /api/saved-views/[id]`
- `POST /api/calendar/conflicts`

Existing task, comment, move and schedule routes write Activity records and
notifications through shared domain helpers.

## 5. Error Handling

- Activity failure inside a core mutation rolls back the transaction.
- Notification polling failure leaves cached notifications visible and exposes
  retry.
- Mention tokens with unknown profile IDs return `VALIDATION_ERROR`.
- Recurrence generation is idempotent.
- Conflict lookup failure does not block event creation; the UI explains that
  conflict status could not be confirmed.
- Quick Capture preserves input after recoverable errors.

## 6. Testing

Automated coverage includes:

- document and calendar viewport contracts;
- Markdown soft-break rendering contract;
- DnD presence in All Projects;
- absence of global project context;
- notification/activity schema and API contracts;
- mention parsing and deduplication;
- recurrence date calculation and idempotency;
- today-task filtering;
- saved-view ownership;
- calendar-overlap detection;
- Quick Capture and Today source contracts;
- complete Vitest, ESLint, TypeScript, Prisma and production-build gates.

Database migration application and real multiuser/manual Google behavior remain
manual validation gates.

## 7. Out of Scope

- email or push notifications;
- Supabase Realtime;
- shared saved views;
- document comments or document mentions;
- cross-project task drag and drop;
- natural-language Quick Capture;
- AI prioritization;
- a “next best action” engine.
