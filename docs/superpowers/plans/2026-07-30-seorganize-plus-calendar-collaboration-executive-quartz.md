# SeOrganize+ Calendar, Collaboration and Executive Quartz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the calendar, upcoming tasks, scheduling and profile flows; add multiuser assignments and attendees; and apply the approved Executive Quartz system to every authenticated page.

**Architecture:** FullCalendar renders normalized Google and local events. Prisma join models provide many-to-many task assignments and persistent event attendees. Shared schedule-dialog and toast providers connect domain actions across pages. Executive Quartz tokens, shadcn primitives and restrained Motion transitions provide the visual layer.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma/PostgreSQL, Supabase Auth, TanStack Query, FullCalendar 6, shadcn/Radix UI, Tailwind CSS, Motion for React, Vitest.

**Execution context:** Work in the existing `feat/seorganizeb2b-wave5` branch. Preserve all pre-existing dirty-worktree changes. Do not reset, discard or stage unrelated files.

**Execution status (2026-07-30):** Implementation and non-destructive
automated validation complete. Production build, ESLint, TypeScript, Prisma
schema validation and 131 Vitest checks pass. Database migration application
and real Google Calendar behavior remain manual gates because the local
Supabase database is offline and the migration removes the legacy
`tasks.assignee_id` column.

---

## File Responsibility Map

### Domain and persistence

- `prisma/schema.prisma`: many-to-many task assignments and event attendee relations.
- `prisma/migrations/20260730090000_multi_assignees_attendees/migration.sql`: safe backfill and schema migration.
- `src/lib/calendar/types.ts`: normalized calendar and attendee types.
- `src/lib/calendar/normalize.ts`: Google normalization and Google/local deduplication.
- `src/lib/calendar/validation.ts`: attendee email and event range validation.
- `src/lib/google/calendar.ts`: Google API transport only.
- `src/lib/google/oauth.ts`: typed token/auth failures.

### API and hooks

- `src/app/api/calendar/events/route.ts`: normalized read and event creation.
- `src/app/api/calendar/schedule/route.ts`: compatibility scheduling entry point.
- `src/app/api/tasks/upcoming/route.ts`: current-user upcoming tasks.
- `src/app/api/projects/[projectId]/tasks/route.ts`: task create/list with assignments.
- `src/app/api/tasks/[taskId]/route.ts`: task read/update/delete with assignments.
- `src/hooks/use-calendar.ts`: calendar queries and mutations.
- `src/hooks/use-tasks.ts`: task mutations with `assigneeIds`.

### Interaction components

- `src/stores/schedule-event-context.tsx`: one schedule dialog available across authenticated routes.
- `src/components/calendar/calendar-view.tsx`: FullCalendar adapter and viewport state.
- `src/components/calendar/schedule-event-modal.tsx`: event form and attendees.
- `src/components/calendar/attendee-selector.tsx`: internal/external attendee multi-select.
- `src/components/calendar/upcoming-tasks-panel.tsx`: real task query states.
- `src/components/people/multi-person-selector.tsx`: task-assignee selector.
- `src/components/people/avatar-group.tsx`: compact multi-person display.
- `src/components/ui/toaster.tsx`: app event listener and Radix/shadcn toast renderer.

### Executive Quartz

- `src/app/globals.css`: FullCalendar and global Executive Quartz styling.
- `tailwind.config.ts`: approved tokens, shadows and typography.
- `src/app/layout.tsx`: local Geist fonts and SeOrganize+ metadata.
- `src/components/layout/app-layout.tsx`: authenticated shell and animated page region.
- `src/components/layout/sidebar.tsx`: responsive Executive Quartz navigation.
- `src/components/layout/topbar.tsx`: page-specific actions.
- `src/components/shared/animated-page.tsx`: reduced-motion-aware page entrance.
- Authenticated pages and domain components: consistent shadcn surfaces and spacing.

---

### Task 1: Establish a Clean Baseline and Align Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: existing test and typecheck commands

- [ ] **Step 1: Capture the baseline failures**

Run:

```bash
npm test
npx tsc --noEmit --incremental false
```

Expected baseline:

- 92 Vitest tests pass and four source-contract tests fail.
- TypeScript reports the pre-existing `RegExpStringIterator` target error in `prisma/__tests__/seed.test.ts`.

- [ ] **Step 2: Align FullCalendar and add Motion**

Run:

```bash
npm install motion @fullcalendar/react@6.1.21
```

Expected:

- `motion` is present.
- every `@fullcalendar/*` package resolves to `6.1.21`.

- [ ] **Step 3: Verify dependency resolution**

Run:

```bash
npm ls motion @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction --depth=0
```

Expected: no invalid or mismatched packages.

---

### Task 2: Build and Test the Calendar Domain Layer

**Files:**
- Create: `src/lib/calendar/types.ts`
- Create: `src/lib/calendar/normalize.ts`
- Create: `src/lib/calendar/validation.ts`
- Create: `src/__tests__/calendar-domain.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add tests covering the exact public functions:

```ts
import { describe, expect, it } from "vitest";
import {
  dedupeCalendarEvents,
  normalizeGoogleEvent,
} from "@/lib/calendar/normalize";
import { normalizeAttendeeEmails } from "@/lib/calendar/validation";

describe("normalizeGoogleEvent", () => {
  it("normalizes timed events", () => {
    expect(normalizeGoogleEvent({
      id: "google-1",
      summary: "Planning",
      start: { dateTime: "2026-07-30T09:00:00-03:00", timeZone: "America/Sao_Paulo" },
      end: { dateTime: "2026-07-30T10:00:00-03:00", timeZone: "America/Sao_Paulo" },
    })).toMatchObject({
      googleId: "google-1",
      title: "Planning",
      allDay: false,
      timeZone: "America/Sao_Paulo",
    });
  });

  it("normalizes all-day events", () => {
    expect(normalizeGoogleEvent({
      id: "google-2",
      summary: "Holiday",
      start: { date: "2026-07-30" },
      end: { date: "2026-07-31" },
    })).toMatchObject({
      allDay: true,
      startTime: "2026-07-30",
      endTime: "2026-07-31",
    });
  });
});

describe("dedupeCalendarEvents", () => {
  it("keeps one event per googleId and preserves the local task link", () => {
    const merged = dedupeCalendarEvents([
      { id: "google-1", googleId: "google-1", source: "google", task: null },
      { id: "local-1", googleId: "google-1", source: "google", task: { id: "task-1", title: "Task" } },
    ] as never);
    expect(merged).toHaveLength(1);
    expect(merged[0].task?.id).toBe("task-1");
  });
});

describe("normalizeAttendeeEmails", () => {
  it("trims, lowercases and deduplicates valid email addresses", () => {
    expect(normalizeAttendeeEmails([" A@Example.com ", "a@example.com"])).toEqual(["a@example.com"]);
  });
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
npx vitest run src/__tests__/calendar-domain.test.ts
```

Expected: module-not-found failures.

- [ ] **Step 3: Implement focused calendar types and pure functions**

Define:

```ts
export type CalendarAttendee = {
  id?: string;
  profileId: string | null;
  email: string;
  displayName: string | null;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction";
  organizer: boolean;
};

export type CalendarEventData = {
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

`normalizeGoogleEvent` must reject missing IDs or missing start/end values, support both `dateTime` and `date`, normalize attendees and retain Google response statuses.

`dedupeCalendarEvents` must key remote mirrors by `googleId` and local-only events by `id`, merging the local task link and persisted attendee metadata into the remote result.

- [ ] **Step 4: Run domain tests**

Run:

```bash
npx vitest run src/__tests__/calendar-domain.test.ts
```

Expected: all domain tests pass.

---

### Task 3: Add Multi-Assignee and Attendee Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260730090000_multi_assignees_attendees/migration.sql`
- Create: `src/__tests__/collaboration-schema.test.ts`

- [ ] **Step 1: Write a schema contract test**

Assert the schema contains `TaskAssignee`, `CalendarEventAttendee`, `assignees TaskAssignee[]`, `attendees CalendarEventAttendee[]`, the composite assignment key and the attendee email uniqueness constraint.

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
npx vitest run src/__tests__/collaboration-schema.test.ts
```

Expected: missing-model assertions fail.

- [ ] **Step 3: Modify Prisma relations**

Add:

```prisma
model TaskAssignee {
  taskId     String
  profileId  String
  assignedBy String
  assignedAt DateTime @default(now())

  task    Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  profile Profile @relation("AssignedTasks", fields: [profileId], references: [id], onDelete: Cascade)

  @@id([taskId, profileId])
  @@index([profileId])
  @@map("task_assignees")
}
```

Add `CalendarEventAttendee` exactly as approved in the design spec, plus matching `Profile` and `CalendarEvent` relation fields.

- [ ] **Step 4: Create a safe SQL migration**

The migration must:

1. create both join tables and indexes;
2. backfill `task_assignees` from every non-null `tasks.assignee_id`;
3. preserve `assigned_by` using `tasks.created_by`;
4. drop the legacy foreign key, index and `assignee_id` only after backfill;
5. add all required foreign keys with approved cascade behavior.

Do not apply the migration to an external database during automated implementation.

- [ ] **Step 5: Validate schema and generated client**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx vitest run src/__tests__/collaboration-schema.test.ts
```

Expected: all commands pass.

---

### Task 4: Migrate Task APIs, Hooks and UI to Multiple Assignees

**Files:**
- Modify: `src/app/api/projects/[projectId]/columns/route.ts`
- Modify: `src/app/api/projects/[projectId]/tasks/route.ts`
- Modify: `src/app/api/tasks/[taskId]/route.ts`
- Create: `src/app/api/tasks/upcoming/route.ts`
- Modify: `src/hooks/use-kanban.ts`
- Modify: `src/hooks/use-tasks.ts`
- Create: `src/components/people/multi-person-selector.tsx`
- Create: `src/components/people/avatar-group.tsx`
- Modify: `src/components/kanban/task-form.tsx`
- Modify: `src/components/kanban/kanban-card.tsx`
- Modify: `src/components/kanban/task-detail-panel.tsx`
- Modify: `src/components/kanban/task-detail-modal.tsx`
- Test: `src/__tests__/task-collaboration.test.ts`

- [ ] **Step 1: Write failing API and source-contract tests**

Cover:

- task create accepts `assigneeIds`;
- task update uses a Prisma nested replacement;
- list and board responses return `assignees`;
- upcoming query uses `assignees: { some: { profileId: session.user.id } }`;
- archived, past and undated tasks are excluded.

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
npx vitest run src/__tests__/task-collaboration.test.ts
```

- [ ] **Step 3: Implement validated assignment writes**

Normalize the request with:

```ts
const assigneeIds = Array.from(
  new Set(Array.isArray(body.assigneeIds) ? body.assigneeIds.filter((id): id is string => typeof id === "string") : [])
);
```

Verify the number of matching profiles equals the number of unique IDs. Create assignments with:

```ts
assignees: {
  create: assigneeIds.map((profileId) => ({
    profileId,
    assignedBy: session.user.id,
  })),
}
```

Updates replace the relation transactionally using `deleteMany` and `create`.

- [ ] **Step 4: Implement upcoming tasks**

Use the start of the current day and query:

```ts
where: {
  archived: false,
  dueDate: { gte: startOfToday },
  assignees: { some: { profileId: session.user.id } },
}
```

Include project, area and assignee profile summaries.

- [ ] **Step 5: Implement reusable people UI**

`MultiPersonSelector` uses existing shadcn Popover, Input, Checkbox and Avatar components. It exposes:

```ts
type MultiPersonSelectorProps = {
  people: PersonOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  disabled?: boolean;
};
```

`AvatarGroup` renders up to three avatars plus a `+N` badge.

- [ ] **Step 6: Update task forms, cards and details**

Replace every scalar `assigneeId` and `assignee` consumer with `assigneeIds` and `assignees`.

- [ ] **Step 7: Run focused and existing task tests**

Run:

```bash
npx vitest run src/__tests__/task-collaboration.test.ts src/__tests__/story-1.5.test.ts
```

Expected: all task tests pass.

---

### Task 5: Correct Google Calendar Transport and APIs

**Files:**
- Modify: `src/lib/google/calendar.ts`
- Modify: `src/lib/google/oauth.ts`
- Modify: `src/app/api/calendar/events/route.ts`
- Modify: `src/app/api/calendar/schedule/route.ts`
- Modify: `src/app/api/calendar/events/[id]/route.ts`
- Test: `src/__tests__/calendar-api.test.ts`

- [ ] **Step 1: Write failing Google adapter tests**

Test:

- all-day events normalize through `start.date` and `end.date`;
- attendees are included;
- event creation calls `/events?sendUpdates=all`;
- DELETE accepts HTTP 204 without parsing JSON;
- typed Google auth errors are preserved.

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
npx vitest run src/__tests__/calendar-api.test.ts
```

- [ ] **Step 3: Make Google transport status-aware**

The request helper must:

```ts
if (!response.ok) {
  const payload = await response.json().catch(() => null);
  throw new GoogleCalendarError(response.status, payload?.error?.message ?? "Google Calendar request failed");
}
if (response.status === 204) return null;
return response.json();
```

- [ ] **Step 4: Implement attendees and all-day events**

Google input supports `dateTime` or `date`, and create input includes:

```ts
attendees?: Array<{ email: string; displayName?: string }>;
```

Use `/calendars/primary/events?sendUpdates=all` for creation.

- [ ] **Step 5: Rebuild event GET merge logic**

Query local events using overlap semantics, include attendees and task, normalize Google results, then call `dedupeCalendarEvents`.

Do not swallow Google errors. Return typed connection/error state that the client can render.

- [ ] **Step 6: Implement event creation**

`POST /api/calendar/events` validates range and attendees, creates Google first when connected, then creates the local mirror and attendees in one Prisma transaction.

Keep `/api/calendar/schedule` as a compatibility wrapper over the same validated server function.

- [ ] **Step 7: Run calendar API tests**

Run:

```bash
npx vitest run src/__tests__/calendar-api.test.ts src/__tests__/story-2.1.test.ts
```

Expected: all calendar API tests pass.

---

### Task 6: Implement FullCalendar, Event Creation and Shared Scheduling

**Files:**
- Modify: `src/hooks/use-calendar.ts`
- Create: `src/stores/schedule-event-context.tsx`
- Modify: `src/app/(authenticated)/layout.tsx`
- Modify: `src/app/(authenticated)/calendar/page.tsx`
- Replace: `src/components/calendar/calendar-view.tsx`
- Modify: `src/components/calendar/calendar-event.tsx`
- Modify: `src/components/calendar/schedule-event-modal.tsx`
- Create: `src/components/calendar/attendee-selector.tsx`
- Modify: `src/components/calendar/upcoming-tasks-panel.tsx`
- Modify: `src/components/kanban/task-detail-panel.tsx`
- Modify: `src/components/kanban/task-detail-modal.tsx`
- Test: `src/__tests__/calendar-ui.test.ts`

- [ ] **Step 1: Write failing UI source-contract tests**

Assert:

- `CalendarView` imports FullCalendar and time-grid, day-grid and interaction plugins;
- selection opens the shared dialog;
- the calendar page renders even while Google is disconnected;
- task schedule buttons call `openForTask`;
- upcoming tasks uses `/api/tasks/upcoming`;
- event dialog exposes attendees.

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
npx vitest run src/__tests__/calendar-ui.test.ts
```

- [ ] **Step 3: Build shared schedule state**

Expose:

```ts
type ScheduleEventDraft = {
  taskId?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendeeProfileIds?: string[];
};

type ScheduleEventContextValue = {
  open: boolean;
  draft: ScheduleEventDraft;
  openBlank: (range?: Pick<ScheduleEventDraft, "startTime" | "endTime">) => void;
  openForTask: (task: BoardTask) => void;
  close: () => void;
};
```

Mount one `ScheduleEventModal` inside the provider.

- [ ] **Step 4: Replace the manual grid with FullCalendar**

Configure:

```tsx
<FullCalendar
  plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
  initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
  selectable
  nowIndicator
  allDaySlot
  events={fullCalendarEvents}
  datesSet={handleDatesSet}
  select={handleSelect}
  eventContent={renderEventContent}
/>
```

Fetch based on `datesSet.startStr` and `datesSet.endStr`.

- [ ] **Step 5: Implement the complete event form**

Support title, description, date, start/end, all-day, internal profiles, external emails and optional task. Preserve form values on failure. Close only after success.

- [ ] **Step 6: Connect task scheduling**

Both task detail variants call `openForTask(task)`. Prefill title, due date and task assignee profiles as attendees.

- [ ] **Step 7: Implement upcoming task states**

Render skeleton, retryable inline error, empty state and populated task cards. The panel stacks below the calendar on mobile.

- [ ] **Step 8: Run calendar UI tests**

Run:

```bash
npx vitest run src/__tests__/calendar-ui.test.ts src/__tests__/story-2.1.test.ts
```

Expected: all calendar UI tests pass.

---

### Task 7: Make Toasts and Profile Name Synchronization Real

**Files:**
- Modify: `src/components/ui/toast.tsx`
- Create: `src/components/ui/toaster.tsx`
- Modify: `src/lib/toast.ts`
- Modify: `src/stores/auth-context.tsx`
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/(authenticated)/layout.tsx`
- Modify: `src/app/(authenticated)/settings/profile/page.tsx`
- Test: `src/__tests__/profile-toast.test.ts`

- [ ] **Step 1: Write failing toast/profile tests**

Assert:

- authenticated layout mounts `Toaster`;
- toaster listens for `app-toast`;
- profile API updates Supabase metadata and Prisma;
- AuthContext exposes `updateUserName`;
- profile page calls it with the returned name.

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
npx vitest run src/__tests__/profile-toast.test.ts
```

- [ ] **Step 3: Implement a functional shadcn toaster**

Use `ToastProvider`, one active toast queue and `ToastViewport`. Event detail is:

```ts
type AppToastDetail = {
  type: "success" | "error" | "info";
  title: string;
  description?: string;
};
```

The listener removes itself on unmount.

- [ ] **Step 4: Update Supabase and Prisma together**

Use the request-bound Supabase server client to call:

```ts
await supabase.auth.updateUser({ data: { full_name: normalizedName } });
```

If metadata update fails, return an error before claiming success. Update Prisma and return the normalized name.

- [ ] **Step 5: Update AuthContext immediately**

`updateUserName` replaces `user.user_metadata.full_name` in local state without reloading.

- [ ] **Step 6: Add accurate flow toasts**

Calendar, task assignment, scheduling and profile flows dispatch success only after confirmed mutations and dispatch descriptive errors otherwise.

- [ ] **Step 7: Run tests**

Run:

```bash
npx vitest run src/__tests__/profile-toast.test.ts src/__tests__/story-2.3.test.ts
```

Expected: all focused tests pass.

---

### Task 8: Apply Executive Quartz Foundations and Motion

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/shared/animated-page.tsx`
- Modify: `src/components/layout/app-layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/lib/constants.ts`
- Test: `src/__tests__/executive-quartz.test.ts`

- [ ] **Step 1: Write failing design-contract tests**

Assert:

- `APP_NAME` equals `SeOrganize+`;
- metadata uses SeOrganize+;
- Tailwind contains Quartz, Navy and Executive Blue tokens;
- shell imports Motion from `motion/react`;
- active navigation uses `layoutId`;
- reduced-motion support exists.

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
npx vitest run src/__tests__/executive-quartz.test.ts
```

- [ ] **Step 3: Install local font and token foundation**

Use local files:

```ts
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
});
```

Add approved Executive Quartz tokens and shadows while retaining semantic Tailwind names consumed by existing components.

- [ ] **Step 4: Build the authenticated shell**

Implement:

- deep navy 240px desktop sidebar;
- “S+” brand mark and SeOrganize+ label;
- tablet icon rail;
- shadcn Dialog-based mobile drawer;
- contextual topbar labels/actions;
- page canvas `#F4F7FB`.

- [ ] **Step 5: Add restrained Motion**

Use:

```tsx
<motion.main
  initial={reduceMotion ? false : { opacity: 0, transform: "translateY(8px)" }}
  animate={{ opacity: 1, transform: "translateY(0px)" }}
  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
/>
```

Use a shared `layoutId` for the sidebar active surface with a no-overshoot spring. Use transform and opacity only.

- [ ] **Step 6: Style FullCalendar and toasts**

Add Executive Quartz overrides for headers, time slots, event pills, now indicator, focus states and responsive behavior.

- [ ] **Step 7: Run design tests**

Run:

```bash
npx vitest run src/__tests__/executive-quartz.test.ts
```

Expected: all design-contract tests pass.

---

### Task 9: Apply Executive Quartz Across Every Authenticated Page

**Files:**
- Modify: `src/app/(authenticated)/page.tsx`
- Modify: `src/app/(authenticated)/all/page.tsx`
- Modify: `src/app/(authenticated)/board/page.tsx`
- Modify: `src/app/(authenticated)/board/[projectId]/page.tsx`
- Modify: `src/app/(authenticated)/projects/page.tsx`
- Modify: `src/app/(authenticated)/projects/[projectId]/page.tsx`
- Modify: `src/app/(authenticated)/calendar/page.tsx`
- Modify: `src/app/(authenticated)/documents/page.tsx`
- Modify: `src/app/(authenticated)/documents/[documentId]/page.tsx`
- Modify: `src/app/(authenticated)/settings/page.tsx`
- Modify: `src/app/(authenticated)/settings/profile/page.tsx`
- Modify: `src/app/(authenticated)/settings/team/page.tsx`
- Modify: `src/app/(authenticated)/settings/areas/page.tsx`
- Modify: relevant components under `src/components/kanban`, `src/components/projects`, and `src/components/documents`
- Test: `src/__tests__/authenticated-pages-design.test.ts`

- [ ] **Step 1: Write a page-coverage test**

Check every authenticated page uses shared Executive Quartz primitives such as `AnimatedPage`, `Card`, shared header patterns or domain containers. Verify no product-facing `SeOrganizeB2B` remains.

- [ ] **Step 2: Run the coverage test and verify failures**

Run:

```bash
npx vitest run src/__tests__/authenticated-pages-design.test.ts
```

- [ ] **Step 3: Migrate pages in functional groups**

Apply:

- consistent 24px desktop page padding and responsive 16px padding;
- shadcn cards, buttons, dialogs, inputs, badges and skeletons;
- meaningful empty states;
- shared headings and contextual actions;
- Executive Quartz border, radius and shadow hierarchy.

Preserve all current behavior and dirty-worktree improvements.

- [ ] **Step 4: Polish domain components**

Add avatar groups, priority accents, restrained hover elevation and responsive layouts. Avoid decorative cards without information value.

- [ ] **Step 5: Run page coverage and story tests**

Run:

```bash
npx vitest run src/__tests__/authenticated-pages-design.test.ts src/__tests__
```

Expected: all tests pass or only clearly classified pre-existing test defects remain for Task 10.

---

### Task 10: Resolve Baseline Test Defects and Complete Automated Validation

**Files:**
- Modify only source or tests whose failure has been classified with evidence.
- Modify: `src/__tests__/story-1.4.test.ts` only if its contract conflicts with approved routing.
- Modify: `src/__tests__/story-1.5.test.ts` only to use the real `[taskId]` route parameter.
- Modify: `src/__tests__/story-2.2.test.ts` only if the approved document editor no longer uses `MDEditor`.
- Modify: `prisma/__tests__/seed.test.ts` or TypeScript test configuration to remove the target incompatibility without weakening assertions.

- [ ] **Step 1: Classify every remaining failure**

For each failing test, record whether implementation is wrong or the source-contract assertion is obsolete. Implementation defects are fixed in source by default.

- [ ] **Step 2: Fix the project-selector contract**

Restore routing from project selection and render `ProjectSelector` in the sidebar if that behavior remains required by the approved shell.

- [ ] **Step 3: Fix only technically incorrect test contracts**

The `[taskId]` route must assert `params.taskId`, not `params.id`. Document editor expectations must assert actual behavior rather than a removed implementation symbol, while preserving editor, preview and save behavior.

- [ ] **Step 4: Run Prisma checks**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

- [ ] **Step 5: Run the complete unit suite**

Run:

```bash
npm test
```

Expected: all tests pass with zero skipped or weakened assertions.

- [ ] **Step 6: Run TypeScript and lint**

Run:

```bash
npx tsc --noEmit
npm run lint
```

Expected: zero errors. Warnings must be reported and classified.

- [ ] **Step 7: Run production build**

Run:

```bash
npm run build
```

Expected: successful Next.js production build.

- [ ] **Step 8: Search completion invariants**

Run:

```bash
rg -n "SeOrganizeB2B|assigneeId|catch \\{|Schedule in Calendar" src prisma/schema.prisma
```

Expected:

- no product-facing old brand;
- no legacy scalar assignee contract;
- no silent calendar catches;
- every schedule button has a functional handler.

- [ ] **Step 9: Prepare the manual validation handoff**

Provide exact steps for:

1. OAuth connection;
2. timed and all-day Google event rendering;
3. event creation with internal and external attendees;
4. invitation receipt;
5. Upcoming Tasks filtering;
6. task scheduling;
7. profile-name persistence;
8. responsive Executive Quartz review;
9. reduced-motion behavior.

- [ ] **Step 10: Prepare commit evidence**

Run:

```bash
git status --short
git diff --stat
git diff
```

Report changed files, tests and suggested logical Conventional Commits. Do not push or create a PR without separate authorization.
