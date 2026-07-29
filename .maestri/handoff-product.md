# SeOrganizeB2B — Product Specification

## 1. Target Users & Personas

### Primary Persona: The Founder/CEO (current user)
- **Name**: Founder
- **Role**: CEO / solo operator of a B2B company
- **Team Area**: Owns all areas initially
- **Needs**: Single pane of glass for all company operations — tasks, docs, calendar
- **Pain points**: Context-switching between Jira/Clickup + Google Calendar + Notion/Docs; overkill complexity of existing tools for a small team
- **Behavior**: Assigns tasks, tracks pipeline, writes meeting notes/docs, blocks time on calendar

### Secondary Persona: Team Member (future)
- **Role**: Employee or contractor (1-5 people)
- **Team Area**: Assigned to one area (defined by founder via CRUD)
- **Needs**: See assigned tasks filtered by their area, update status, comment, view shared calendar, read/edit team documents
- **Pain points**: Too many tools; wants a single source of truth scoped to their area of responsibility

### Anti-Personas (NOT building for)
- Enterprise PMOs requiring compliance reports, audit trails, role-based access control
- External clients or stakeholders

## 2. Feature List

### MVP

| Area | Feature | Description |
|------|---------|-------------|
| **Projects** | Project CRUD | Create, edit, archive/delete projects |
| **Projects** | Project detail | Name, description, team area owner, member list |
| **Projects** | Per-project Kanban | Each project gets its own Kanban board with columns |
| **Kanban** | Board view | Visual pipeline with columns (To Do, In Progress, Done) per project |
| **Kanban** | Board selector | Dropdown/sidebar to switch between project boards |
| **Kanban** | Drag-and-drop | Move cards between columns within a project board |
| **Kanban** | Column config | Admin can rename columns or adjust the pipeline per project |
| **Team Areas** | Area CRUD | Create, edit, and delete team areas dynamically (user-managed) |
| **Team Areas** | Area management UI | Dedicated settings page to manage the area list |
| **Team Areas** | Area assignment | Each team member assigned to one area |
| **Team Areas** | Area filter | Filter tasks/boards by team area |
| **Tasks** | CRUD | Create, edit, delete tasks within a project |
| **Tasks** | Project linking | Every task belongs to exactly one project |
| **Tasks** | Team Area tag | Tasks tagged with a team area (auto-set from assignee's area or manual) |
| **Tasks** | Assignment | Assign to a team member |
| **Tasks** | Status | Task status linked to Kanban column |
| **Tasks** | Priority | Low/Medium/High/Urgent |
| **Tasks** | Due dates | Date picker + overdue highlighting |
| **Tasks** | Comments | Threaded comments on each task |
| **Agenda** | Google Calendar read | Fetch calendar events and display in-app |
| **Agenda** | Google Calendar write | Create calendar blocks from tasks ("schedule time for this task") |
| **Agenda** | Calendar view | Daily/weekly view with task overlay, filterable by project or area |
| **Documents** | .md file list | Browse project documents (scoped to project or global) |
| **Documents** | View .md | In-browser rendered markdown |
| **Documents** | Edit .md | In-browser markdown editor (split preview) |
| **Documents** | Create .md | New document from scratch or template |
| **Auth** | Magic link / OAuth | Simple authentication (Google SSO) |
| **Auth** | Single user | MVP: founder-only, multi-user added post-MVP |

### Future Roadmap (Post-MVP)

- **Multi-user**: Invite team members via email, assign them to a team area
- **Cross-project task view**: Global "My Tasks" showing tasks across all projects
- **Notifications**: In-app + email when assigned/@mentioned
- **Task dependencies**: Blocked-by relationships
- **Time tracking**: Log hours against tasks
- **Recurring tasks**: "Every Monday, create..."
- **File attachments**: Upload images/PDFs to tasks
- **Advanced Google Calendar**: 2-way sync, auto-scheduling, busy-time detection
- **Document versioning**: .md history and diffs
- **Document templates**: Pre-defined doc types (meeting notes, RFC, etc.)
- **Mobile-friendly**: Responsive web or PWA
- **API**: Headless API for integrations
- **Search**: Full-text search across tasks + docs + calendar, filterable by project/area
- **Analytics dashboard**: Burndown per project, velocity, workload by area
- **Area-level dashboards**: Each team area lead sees rollup of their area's projects

## 3. User Flows

### Flow A: Daily standup — see what's on my plate
1. User opens the app
2. Default view: the last-visited project's Kanban board (or a "My Tasks" aggregate view post-MVP)
3. MVP: user selects their project from the board selector dropdown
4. Each card shows: title, priority badge, due date, comment count, team area badge
5. If a task has no due date, it shows a subtle placeholder
6. **Edge case**: Zero tasks assigned → empty state with prompt to create one
7. **Edge case**: Overdue tasks → card border turns red, sorted to top of column

### Flow B: Create a project
1. Click "+ New Project" in the sidebar or projects page
2. Modal with fields: name*, description, team area (optional, selected from user-managed list)
3. Save creates project + its default Kanban board (To Do / In Progress / Done)
4. User lands on the new project's empty Kanban board
5. **Edge case**: Name required, duplicate name warning
6. **Edge case**: Zero projects → landing page prompts to create first project

### Flow C: Create and assign a task (within a project)
1. From a project's Kanban board, click "+ New Task" (global or per-column)
2. Modal with fields: title*, description, assignee, team area (defaults to assignee's area, selected from user-managed list), priority, due date
3. Task is automatically linked to the current project
4. Save creates task, places it in the first (leftmost) column of that project's board
5. Task appears in real-time on the board
6. **Edge case**: Form validation → title required, date must be today or future (warning, not block)
7. **Edge case**: Network failure → toast with retry, form state preserved

### Flow D: Move a task through the pipeline
1. Drag card from "In Progress" to "Done" on the project's board
2. Optimistic UI update; status change sent to Supabase
3. On success: card stays in Done; on failure: card snaps back, toast error
4. **Edge case**: User drags to a column that doesn't exist (impossible via UI, but guard API)

### Flow E: Filter by team area
1. On a project's Kanban board, user opens the filter dropdown
2. Dropdown lists all areas defined by the founder (e.g., Sales, Engineering, Marketing)
3. Select an area to see only tasks tagged with that area
4. Board re-renders showing only matching cards; other columns may appear empty
5. Clear filter to return to all tasks
6. **Edge case**: No tasks match the filter → column-level empty states ("No tasks for this area in this column")
7. **Edge case**: User with no team area assigned → cannot filter by area until admin assigns one
8. **Edge case**: An area is deleted while tasks still reference it → tasks show "Unassigned Area" badge; founder prompted to reassign

### Flow F: Manage team areas
1. Navigate to Settings > Team Areas
2. See a table/list of all existing areas with name and task/project count
3. Click "+ Add Area" to create a new one (name required)
4. Click edit icon to rename an existing area
5. Click delete icon to remove an area; confirmation modal warns if areas are in use
6. **Edge case**: Delete area with active tasks/projects → modal lists affected items, founder must confirm or reassign
7. **Edge case**: Two areas with the same name → duplicate name validation on save
8. **Edge case**: Deleting the last remaining area → warning that tasks will lose area context; founder can still proceed

### Flow G: Schedule a task on the calendar
1. From task detail view, click "Schedule in Calendar"
2. Google OAuth flow (first time) or reuse token
3. Modal: pick date + duration (default: due date, 1h); optionally include project name in event title
4. Creates Google Calendar event, links event URL back to task
5. Task card gains a calendar icon showing scheduled status
6. **Edge case**: Google token expired → re-auth via popup, return to same state
7. **Edge case**: Task has no due date → prompt user to set one first

### Flow H: Write a meeting note (.md document)
1. Navigate to Documents area (can be project-scoped or global)
2. Click "+ New Document"
3. Title field at top, markdown editor below with live preview
4. Optional: link document to a project (appears under that project's docs)
5. Save persists to Supabase as .md
6. Document appears in the sidebar/file list under the linked project
7. **Edge case**: Concurrent edit (post-MVP only; MVP locks via last-writer-wins)
8. **Edge case**: Large .md file → lazy-load preview, editor remains performant

### Flow I: Comment on a task
1. Open task detail (click card or "View" link)
2. Scroll to comments section at bottom
3. Write comment in text area, press Enter or click "Post"
4. Comment appears in thread, newest at bottom
5. **Edge case**: Empty comment → submit button disabled
6. **Edge case**: Long comment → text area auto-expands, no hard character limit

## 4. Success Metrics

| Metric | How to Measure | Target (3 months) |
|--------|---------------|-------------------|
| DAU / WAU | App analytics | 5/7 weekly active (team of 5-7) |
| Projects created | DB count | > 3 active projects |
| Tasks created per week | DB count | > 20/week |
| Tasks completed per week | DB status changes | > 15/week |
| Tasks tagged with team area | DB (coverage) | 100% of tasks have an area tag |
| Calendar events created from tasks | Google API events | > 5/week |
| Documents created per week | DB count | > 3/week |
| User satisfaction | Periodic survey | NPS > 40 |
| Time to create a task | Session recording | < 30s |
| Uptime | Vercel/Supabase status | > 99.5% |
| Free tier headroom | Supabase usage dashboard | < 80% of free tier limits |

## 5. Decisions Log

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| Monorepo structure | Single Next.js app (monolith) | Small team, fast iteration; avoids microservice overhead |
| Database | Supabase (Postgres) | Free tier generous, real-time subscriptions, auth built-in |
| Auth | Google OAuth via Supabase | Users already have Google accounts; magic link backup |
| Calendar integration | Google Calendar API (read + write) | Market leader, founder uses Google Workspace |
| Documents format | .md stored as text in DB | No file storage needed (avoids Supabase storage limits), renders natively |
| Kanban library | Pragmatic drag-and-drop (or dnd-kit) | Lightweight, React-native, no paid tier |
| Board-per-project model | Each project owns its own Kanban board | Clean separation of concerns; users see only relevant context |
| Team area management | User-managed CRUD (create, edit, delete) | Founder's company structure evolves; hardcoded areas would require code changes to adapt |
| Team area on tasks | Tag on task entity, defaults from assignee | Simple query model; area filter is a WHERE clause, not a separate table join |
| Deploy target | Vercel (free tier) | First-party Next.js hosting, zero ops, generous free tier |
| Multi-user | Post-MVP | Founder is sole user initially; team grows later |
| Real-time | Supabase Realtime (WebSockets) | Built into Supabase, no additional infra |
| Styling | Tailwind CSS + shadcn/ui | Fastest path to consistent UI, used at many B2B startups |
| State management | React Query (TanStack Query) | Server-state best practice; pairs with Supabase |
| Editor for .md | MDXEditor or CodeMirror | Free, MIT license, extensible for future features
