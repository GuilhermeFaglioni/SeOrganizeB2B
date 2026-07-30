# Board Controls and Calendar Details Design

**Status:** Approved by user before implementation
**Visual direction:** Executive Quartz

## Objective

Correct the task-form viewport regression and improve operational navigation:

- task form uses a wide, responsive two-column dialog;
- calendar events are clickable and expose full details;
- local events can link to a task and a team area;
- saved views use an application dialog instead of `window.prompt`;
- Board filters by assignee, team area and due-date range;
- Board sorts by manual order, priority, due date or title;
- Board groups visually by primary assignee or team area;
- team-area filtering is removed from the sidebar.

## Interaction Design

### Task form

Desktop uses a `max-w-3xl` dialog. Title and description occupy the left
column; assignment, area, priority, due date and recurrence occupy the right.
Mobile collapses to one column. Content scrolls inside `90vh`; footer remains
reachable.

### Event details

Clicking a FullCalendar event opens an event-detail dialog. It shows title,
description, complete time range, source, timezone, task, team area and
attendees. Internal attendees are identified by `profileId`; external
attendees remain email-only.

Local mirrored events support updating `taskId` and `areaId`. Google-only
events without a local row are read-only until synchronized.

### Saved views

The save action opens a controlled Dialog with a required name field. The view
persists every Board query control: project, temporal mode, assignee, area,
date range, sort and grouping.

### Board controls

Filters are URL-backed and composable. Date range is inclusive by calendar
day. Assignee and area filters are single-value selectors with an `All`
option. Sorting is stable. Grouping assigns each task to one visual group:
first assignee or `Unassigned`, and task area or `No area`.

Grouped rendering is a visualization layer; workflow-column DnD remains the
canonical default view.

## Persistence

`CalendarEvent` receives nullable `areaId` with `onDelete: SetNull`. A new
additive migration creates the column, index and foreign key. Saved-view
filters remain JSON and require no schema change.

## Validation

- source-contract tests for wide dialog, clickable event details, internal
  save dialog, Board query controls and sidebar cleanup;
- pure tests for task filtering, stable sorting and grouping;
- full Vitest, ESLint, TypeScript, Prisma and production-build gates.
