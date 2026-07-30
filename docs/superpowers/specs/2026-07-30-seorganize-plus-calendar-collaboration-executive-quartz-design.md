# SeOrganize+ — Calendar, Collaboration and Executive Quartz Design

**Date:** 2026-07-30  
**Status:** Approved in conversation; pending implementation plan  
**Visual direction:** Executive Quartz  
**Scope:** All authenticated product pages

## 1. Objective

Deliver a reliable calendar and collaboration experience while upgrading the authenticated product to the Executive Quartz visual system.

The delivery must:

- render Google Calendar events inside the calendar grid;
- support timed and all-day Google events correctly;
- allow creating an event from the calendar;
- load upcoming tasks assigned to the current user;
- make every “Schedule in Calendar” action functional;
- update the user name immediately after saving;
- rename the product from SeOrganizeB2B to SeOrganize+;
- support multiple task assignees;
- support multiple event attendees, including team members and external email addresses;
- provide actionable success and error toasts;
- apply shadcn components and Motion animations across all authenticated pages.

## 2. Current-State Findings

### 2.1 Calendar rendering

The current calendar uses a manually positioned CSS grid. Event nodes are absolutely positioned without a reliable grid positioning context, use a fixed event height and derive day offsets by dividing milliseconds by 24 hours. This is fragile across time zones, daylight-saving changes, all-day events and overlapping events.

The Google adapter also reads `event.start.dateTime || event.start.dateTime`, so all-day events represented by `start.date` and `end.date` produce invalid values.

### 2.2 Event duplication and error handling

Google events and local mirrored events are concatenated without deduplication. A newly scheduled Google event can therefore appear twice.

Google fetch and create errors are silently caught. The UI cannot distinguish a disconnected calendar, expired authorization or an API failure.

The local range query only returns events fully contained inside the requested range. Events that overlap the range boundaries are excluded.

### 2.3 Upcoming tasks

The calendar page derives “tasks” from project summaries. These synthetic entries have `dueDate: null`, and the upcoming panel filters every entry out. No real task query is performed.

### 2.4 Scheduling actions

The calendar owns a schedule modal state but exposes no button that opens it. Task detail buttons render without click handlers and do not pass task data to the schedule modal.

### 2.5 Profile name

The profile route updates the Prisma profile, while visible navigation reads Supabase user metadata. The client authentication context is not refreshed after the save, so the old name remains visible.

## 3. Architecture

### 3.1 Calendar engine

Use FullCalendar, which is already installed, for week and day rendering. FullCalendar owns time-slot layout, overlapping event placement, current-time indicators, responsive views and selection.

The application retains control over:

- data fetching through TanStack Query;
- Google and local event normalization;
- event colors and Executive Quartz styling;
- create, detail and delete dialogs;
- task links and attendee presentation;
- toasts and error recovery.

The calendar remains visible without a Google connection. In that state, users may create local events and see a non-blocking connection callout.

### 3.2 Event normalization

Introduce a domain-level calendar event shape:

```ts
type CalendarEvent = {
  id: string;
  googleId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timeZone: string | null;
  color: string | null;
  source: "google" | "local";
  task: { id: string; title: string } | null;
  attendees: CalendarAttendee[];
};
```

Google `dateTime` and `date` values are normalized explicitly. Invalid events are rejected with diagnostics instead of being rendered as floating notifications.

Google and local results are merged by `googleId`. A local mirrored event is enriched with Google state instead of appended as a duplicate.

Range predicates use overlap semantics:

```text
event.start < range.end AND event.end > range.start
```

### 3.3 Creation and scheduling

The calendar exposes two creation paths:

1. the topbar “New event” action;
2. selecting a time range directly in FullCalendar.

Both open the same shadcn dialog. The form contains title, date, start, duration/end, description, attendee selection and optional task link.

“Schedule in Calendar” opens this dialog with task title, task ID, due date and assignees prefilled.

When Google is connected:

1. validate input;
2. create the Google event;
3. persist a local mirror with `googleId`;
4. invalidate calendar and task queries;
5. display a success toast.

If Google creation fails, no false success is returned. The dialog stays open and presents retry or reconnection. When Google is not connected, the event is saved locally and the toast states this explicitly.

### 3.4 Upcoming tasks

Add a dedicated authenticated endpoint for upcoming tasks.

It returns tasks that are:

- assigned to the current profile through the many-to-many assignment relation;
- not archived;
- due today or later;
- ordered by due date ascending;
- enriched with project, area, priority and assignee summaries.

The panel has loading skeletons, an inline error with retry, a true empty state and a limit with a link to all tasks.

### 3.5 Profile synchronization

Saving a name updates:

1. the Prisma `Profile`;
2. Supabase user metadata (`full_name`);
3. the local AuthContext user value.

The sidebar and profile form update without a full reload. The form trims input, prevents blank names and shows success or error toasts.

## 4. Multiuser Collaboration

### 4.1 Task assignees

Replace the single `Task.assigneeId` relation with a join model:

```prisma
model TaskAssignee {
  taskId     String
  profileId  String
  assignedBy String
  assignedAt DateTime @default(now())

  task       Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  profile    Profile @relation("AssignedTasks", fields: [profileId], references: [id], onDelete: Cascade)

  @@id([taskId, profileId])
  @@index([profileId])
  @@map("task_assignees")
}
```

The migration creates the join table, backfills every current `assigneeId`, validates the backfill and only then removes the legacy column and index.

Task create and update APIs accept `assigneeIds: string[]`. IDs are deduplicated and validated against existing profiles. Responses return `assignees[]`.

Existing task cards, forms, detail views, filters, board queries and upcoming task queries use the new relation.

### 4.2 Event attendees

Add a persistent attendee model:

```prisma
model CalendarEventAttendee {
  id             String   @id @default(uuid())
  eventId        String
  profileId      String?
  email          String
  displayName    String?
  responseStatus String   @default("needsAction")
  organizer      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  event          CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  profile        Profile?      @relation(fields: [profileId], references: [id], onDelete: SetNull)

  @@unique([eventId, email])
  @@index([profileId])
  @@map("calendar_event_attendees")
}
```

The event form supports:

- searching and selecting multiple team members;
- adding validated external email addresses;
- removing selected attendees;
- displaying selected people as avatar chips.

Google event creation receives `attendees[]` and uses `sendUpdates=all`. Google response statuses are normalized to `accepted`, `declined`, `tentative` or `needsAction`.

Local events preserve attendees without requiring Google. Google invitations are in scope; a separate task-notification inbox is not.

## 5. API Contracts

### 5.1 Calendar events

```text
GET /api/calendar/events?timeMin=<iso>&timeMax=<iso>
```

Returns normalized, deduplicated events and connection status. Google failures return typed error information instead of being silently discarded.

```text
POST /api/calendar/events
```

Creates a calendar event. The request includes attendee objects, client time zone and optional task ID.

The existing schedule route may be retained as a compatibility wrapper or replaced after all consumers move to the event endpoint.

### 5.2 Upcoming tasks

```text
GET /api/tasks/upcoming?limit=10
```

Returns only future, non-archived tasks assigned to the current user.

### 5.3 Tasks

Task POST and PATCH payloads use:

```ts
{
  assigneeIds: string[];
}
```

The legacy scalar `assigneeId` contract is removed after all internal consumers migrate.

### 5.4 Profile

```text
PATCH /api/profile
```

Returns the updated profile and updated user metadata required by AuthContext.

## 6. Executive Quartz Design System

Executive Quartz is the fixed visual direction.

### 6.1 Tokens

- Page canvas: `#F4F7FB`
- Sidebar: `#10233F`
- Sidebar active: translucent white elevation
- Primary: `#2F6FED`
- Primary hover: `#245FD1`
- Main text: `#132238`
- Secondary text: `#64748B`
- Surface: `#FFFFFF`
- Border: `#DCE4EF`
- Success: `#16845B`
- Warning: `#B66A12`
- Danger: `#C93C48`

The existing 4px spacing grid, compact type scale, 56px topbar, 240px desktop sidebar and accessibility requirements remain authoritative.

Use local Geist variable fonts already present in the repository, avoiding runtime font downloads.

### 6.2 Authenticated shell

The sidebar uses the deep navy surface, a SeOrganize+ “S+” mark, grouped navigation, project context and a user section. The active route uses a shared animated highlight.

The topbar provides breadcrumbs, page title and one contextual primary action. Generic “New” behavior is removed in favor of page-specific labels.

Tablet uses a compact icon rail. Mobile uses a shadcn `Sheet`.

### 6.3 Page coverage

Executive Quartz applies to:

- Board;
- Projects and project details;
- All Tasks;
- Calendar;
- Documents list and editor;
- Settings, Profile, Team and Areas.

Use shadcn primitives for cards, buttons, dialogs, sheets, tabs, menus, popovers, commands, tooltips, skeletons and toasts. Domain components remain application-owned.

## 7. Motion Design

Use `motion`, imported from `motion/react` in client components.

- Page entrance: opacity and `translateY(8px)`, 240ms.
- Sidebar active item: shared `layoutId` with a no-overshoot spring.
- Cards: 2px hover elevation and shadow change; no playful scaling.
- Dialogs and sheets: opacity with `scale(0.98 → 1)`, 180ms.
- Calendar events: short mount transition inside their slots.
- Toasts: subtle horizontal entry and fade exit.

Animations use transform and opacity only where practical. The calendar grid itself does not animate during navigation. `prefers-reduced-motion` removes spatial transitions and springs.

## 8. Toasts and Error States

Add toasts for:

- event created and synced with Google;
- event saved locally;
- Google authorization expired;
- Google event creation failure;
- task scheduled;
- task assignment updated;
- profile name updated;
- recoverable calendar and upcoming-task fetch failures.

Structural loading and error states remain inline. Toasts complement state; they do not replace empty states, field validation or retry controls.

API errors use stable codes, including:

- `GOOGLE_AUTH_REQUIRED`;
- `GOOGLE_AUTH_EXPIRED`;
- `GOOGLE_API_ERROR`;
- `VALIDATION_ERROR`;
- `NOT_FOUND`;
- `FORBIDDEN`.

## 9. Accessibility and Responsive Behavior

- Maintain WCAG AA contrast.
- Every interactive element has a visible focus state.
- FullCalendar actions and custom controls are keyboard accessible.
- Event labels announce time, title and attendee count.
- Multi-select controls expose selection and removal semantics.
- Toast region uses `aria-live="polite"`; destructive failures use `role="alert"`.
- Desktop renders week view.
- Tablet defaults to day view and keeps week view available.
- Mobile uses day view and moves upcoming tasks below the calendar.
- Touch targets are at least 44px on mobile.

## 10. Testing Strategy

### 10.1 Unit tests

- Google timed-event normalization;
- Google all-day-event normalization;
- timezone preservation;
- invalid Google event rejection;
- overlap range predicates;
- Google/local deduplication;
- attendee email validation and deduplication;
- task assignee validation.

### 10.2 API tests

- upcoming tasks return only tasks assigned to the current user;
- archived, undated and past tasks are excluded;
- task create and update persist multiple assignees;
- calendar creation supports local and Google modes;
- Google failure does not return false success;
- Google payload includes attendees and `sendUpdates=all`;
- profile save updates both persistence layers.

### 10.3 Component tests

- calendar renders events inside slots;
- selecting a range opens the populated event dialog;
- “New event” opens the same dialog;
- “Schedule in Calendar” passes task context;
- upcoming panel supports loading, error, empty and populated states;
- multi-assignee and attendee selectors support add/remove;
- sidebar name updates immediately;
- reduced-motion mode disables spatial animation.

### 10.4 Verification gates

- Prisma validation and generated client;
- migration verification with legacy assignee data;
- unit and integration tests;
- TypeScript typecheck;
- ESLint;
- production build;
- responsive browser validation;
- real Google account validation for OAuth, event retrieval, all-day events, creation and invitations.

Existing baseline test failures must be classified and resolved without weakening assertions or masking failures.

## 11. Acceptance Criteria

1. Google timed and all-day events render inside the correct calendar slots.
2. No event is displayed as a detached “nearest event” notification.
3. Google and local mirror records render once.
4. Users can create local or Google events from the calendar.
5. Upcoming Tasks loads future tasks assigned to the current user.
6. Every “Schedule in Calendar” button opens a functional, prefilled dialog.
7. Saving a name updates the form, sidebar and subsequent sessions.
8. Product-facing name is SeOrganize+.
9. Tasks support multiple assignees throughout create, edit, filter and display flows.
10. Events support multiple internal and external attendees.
11. Google attendees receive invitations.
12. Relevant actions provide accurate success or error toasts.
13. All authenticated pages use Executive Quartz and shadcn primitives consistently.
14. Motion animations are restrained, performant and reduced-motion aware.
15. Automated checks pass, and real Google behavior is manually validated.

## 12. Out of Scope

- A standalone notification inbox for task assignments.
- Calendar providers other than Google.
- Recurrence-rule authoring.
- Resource-room scheduling.
- Full offline synchronization.

