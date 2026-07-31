# Mobile layout and safe-area fixes

## Context

Mobile screenshots expose four related layout failures:

1. The mobile sidebar trigger is fixed independently from the topbar and covers the page title.
2. The document editor toolbar is too wide for a narrow viewport, causing the Save action to disappear.
3. The task detail panel keeps its desktop width (`400px`) and occupies only a corner of the mobile viewport.
4. Bottom controls can be covered by the iPhone browser safe area and home indicator.

The scope is presentation and interaction layout only. No API, persistence, or data-model changes.

## Chosen approach

Use focused responsive changes in the existing layout components. Do not introduce a new sheet primitive or rewrite the mobile shell.

This keeps existing desktop behavior stable while fixing the affected mobile paths with the smallest surface area:

- `AppLayout` owns the mobile menu state and coordinates `Sidebar` and `Topbar`.
- `Topbar` renders the mobile menu trigger in normal header flow.
- `TaskDetailPanel` changes from an inline `400px` panel to a viewport sheet at mobile widths.
- `DocumentEditor` keeps Save available as an icon action on mobile.
- Safe-area spacing is applied to the shell and fixed bottom surfaces.

## Component behavior

### App shell and sidebar

`AppLayout` owns `mobileMenuOpen`. It passes the state and close handler to `Sidebar`, and passes an open handler to `Topbar`.

On mobile, `Sidebar` renders only the drawer and backdrop. It does not render an independently positioned hamburger button. The menu trigger appears in the topbar alongside the brand/title, notification control, and page action.

The shell uses a dynamic viewport height (`100dvh`) so browser chrome changes do not clip the application. The mobile drawer and its footer use safe-area-aware bottom padding.

### Topbar

The topbar remains a fixed-height header in layout flow. Its mobile content must satisfy:

- menu trigger is part of the flex row;
- title region can shrink and truncate instead of being covered;
- notification and page action remain reachable and do not shrink below their hit target;
- controls keep at least a 44px touch target.

The mobile menu button has an accessible label and does not alter desktop/tablet rendering.

### Document editor

The editor toolbar remains functional at narrow widths. The Save control switches to icon-only presentation below the mobile breakpoint while retaining:

- `aria-label="Save document"`;
- `title="Save document"`;
- disabled/loading state while the mutation is pending;
- the existing save handler and persistence behavior.

The edit/split/preview controls remain available. Toolbar layout may wrap if the viewport cannot fit all controls.

### Task detail panel

At mobile widths, `TaskDetailPanel` becomes a full-width sheet below the topbar:

- horizontal edges pinned to the viewport;
- top edge aligned below the 56px topbar;
- bottom edge aligned to the dynamic viewport bottom;
- internal content scrolls independently;
- header close control stays visible;
- action buttons wrap without horizontal overflow;
- content includes safe-area-aware bottom padding.

At tablet and desktop widths, retain the current inline right-side panel and width.

The task selection and edit/delete/archive callbacks remain unchanged.

### Safe-area handling

Use the CSS environment variable `env(safe-area-inset-bottom)` through reusable utility classes or equivalent Tailwind arbitrary values. Apply it to:

- mobile sidebar footer;
- fixed toast viewport;
- mobile task sheet content/footer area;
- other fixed bottom action surfaces found during implementation.

Do not add global body padding that would create permanent blank space on non-iPhone browsers.

## Acceptance criteria

- On mobile, hamburger appears inside the topbar and no longer covers/truncates the title.
- On mobile document editing, Save remains visible as an icon button and is keyboard/screen-reader accessible.
- On mobile task selection, the detail panel occupies the full content viewport below the topbar, with internal scrolling and no horizontal overflow.
- Logout, toasts, task actions, and other fixed bottom controls remain above the iPhone safe area.
- Desktop and tablet sidebar, topbar, editor, and task panel behavior remain unchanged.
- No API or persistence behavior changes.

## Verification

Automated checks:

- add/update focused source regression tests for the mobile menu ownership, icon Save action, full-width task sheet classes, dynamic viewport, and safe-area utilities;
- run `npm test`;
- run `npm run lint`;
- run `npm run build`.

Manual responsive checks, if the local browser/device emulation is available:

- 390px-wide viewport with the Today, Documents, and Board routes;
- open/close mobile sidebar;
- edit and save a document;
- open, scroll, and close a task detail;
- inspect bottom logout/toast/action visibility with an iPhone safe-area emulation.
