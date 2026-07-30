# Board Controls and Calendar Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved horizontal task form, clickable event details,
native saved-view dialog and advanced Board controls.

**Architecture:** Pure Board transformation helpers own filtering, sorting and
grouping. URL parameters are the Board state and saved-view contract.
Calendar-event details reuse normalized event data and PATCH owned local
events for task/area associations.

**Tech Stack:** Next.js 14, React 18, TypeScript, Prisma, TanStack Query,
FullCalendar, Radix/shadcn, Vitest.

---

### Task 1: Lock contracts

**Files:**
- Create: `src/__tests__/board-calendar-controls.test.ts`
- Create: `src/__tests__/board-task-transforms.test.ts`

- [ ] Assert wide responsive task dialog and internal scrolling.
- [ ] Assert CalendarView opens EventDetailModal.
- [ ] Assert saved views contain no `window.prompt`.
- [ ] Assert sidebar contains no AreaFilter.
- [ ] Run focused tests and verify RED.

### Task 2: Correct task dialog

**Files:**
- Modify: `src/components/kanban/task-form.tsx`

- [ ] Set `max-h-[90vh] max-w-3xl overflow-y-auto`.
- [ ] Split form fields into responsive desktop columns.
- [ ] Run focused contract test.

### Task 3: Persist calendar team area

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260730130000_calendar_event_area/migration.sql`
- Modify: calendar schedule/list/update APIs and normalized types.

- [ ] Add nullable `CalendarEvent.areaId` relation and index.
- [ ] Add additive SQL with `ON DELETE SET NULL`.
- [ ] Return task, area and attendees from calendar APIs.
- [ ] Add owned PATCH for `taskId` and `areaId`.
- [ ] Run Prisma format, validate and generate without applying migration.

### Task 4: Add event detail dialog

**Files:**
- Create: `src/components/calendar/event-detail-modal.tsx`
- Modify: `src/components/calendar/calendar-view.tsx`
- Modify: `src/hooks/use-calendar.ts`

- [ ] Open selected normalized event on FullCalendar click.
- [ ] Render description, time, source, timezone and attendee classification.
- [ ] Allow task and area association for local events.
- [ ] Invalidate calendar and activity queries after update.

### Task 5: Replace browser prompt

**Files:**
- Modify: `src/components/board/saved-view-control.tsx`

- [ ] Add controlled Dialog, Input and validation.
- [ ] Preserve loading, success and error states.
- [ ] Verify no browser prompt remains.

### Task 6: Add Board transformations and controls

**Files:**
- Create: `src/lib/board/task-transforms.ts`
- Create: `src/components/board/board-controls.tsx`
- Modify: `src/app/(authenticated)/board/page.tsx`
- Modify: `src/components/kanban/kanban-board.tsx`
- Modify: `src/components/kanban/kanban-column.tsx`
- Modify: `src/hooks/use-saved-views.ts`

- [ ] Implement composable assignee, area and inclusive due-range filters.
- [ ] Implement stable priority, due-date and title sorting.
- [ ] Implement primary-assignee and area visual grouping.
- [ ] Persist all controls in URL and saved views.
- [ ] Apply transformations to single and All Projects boards.

### Task 7: Remove sidebar area filter

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] Remove AreaFilter, area query and query-string mutation.
- [ ] Keep navigation and responsive sidebar behavior unchanged.

### Task 8: Verify

- [ ] Run focused tests.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit --incremental false`.
- [ ] Run Prisma format, validate and generate.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
