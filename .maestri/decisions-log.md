# Decisions Log

| Date | Decision | Option Chosen | Rationale |
|------|----------|--------------|-----------|
| 2026-07-29 | Monorepo structure | Single Next.js app (monolith) | Small team, fast iteration; avoids microservice overhead |
| 2026-07-29 | Database | Supabase (Postgres) | Free tier generous, real-time subscriptions, auth built-in |
| 2026-07-29 | Auth | Google OAuth via Supabase | Users already have Google accounts; magic link backup |
| 2026-07-29 | Calendar integration | Google Calendar API (read + write) | Market leader, founder uses Google Workspace |
| 2026-07-29 | Documents format | .md stored as text in DB | No file storage needed, renders natively |
| 2026-07-29 | Kanban library | @dnd-kit/core + @dnd-kit/sortable | Lightweight, React-native, no paid tier |
| 2026-07-29 | Board-per-project model | Each project owns its own Kanban board | Clean separation of concerns |
| 2026-07-29 | Team area management | User-managed CRUD (create, edit, delete) | Founder's company structure evolves |
| 2026-07-29 | Team area on tasks | Tag on task entity, defaults from assignee | Simple query model |
| 2026-07-29 | Deploy target | Vercel (free tier) | First-party Next.js hosting, zero ops |
| 2026-07-29 | Multi-user | Post-MVP | Founder is sole user initially |
| 2026-07-29 | Real-time | Supabase Realtime (WebSockets) | Built into Supabase, no additional infra |
| 2026-07-29 | Styling | Tailwind CSS + shadcn/ui | Fastest path to consistent UI |
| 2026-07-29 | State management | TanStack Query (React Query) | Server-state best practice |
| 2026-07-29 | Editor for .md | @uiw/react-md-editor (CodeMirror-based) | MIT license, lightweight, split preview |
| 2026-07-29 | Framework | Next.js 14 (App Router) | Nested layouts map to wireframes, server components |
| 2026-07-29 | ORM | Prisma (direct TCP, no PostgREST) | Type generation, migrations, broader ecosystem |
| 2026-07-29 | Reorder algorithm | Fractional indexing (real position in Postgres) | Avoids reindexing all cards on every drag |
| 2026-07-29 | Conflict resolution | Last-Writer-Wins (MVP) | Single user initially; no merge complexity |
| 2026-07-29 | API style | REST via Next.js Route Handlers (no tRPC) | Sufficient for 10-15 endpoints, simpler |
| 2026-07-29 | Calendar sync direction | Read Google Calendar → display; Write → Google Calendar | No 2-way sync in MVP (post-MVP with webhooks) |
| 2026-07-29 | Document storage | TEXT column in Postgres (not object storage) | Small docs, full-text search ready, simpler backups |
| 2026-07-29 | Auth enforcement | Application-layer (no RLS) | Prisma bypasses PostgREST; RLS would not apply |
| 2026-07-29 | Sprint strategy | 2 sprints, 9 stories total | Story 1.5 (Kanban) is largest at 2.5d; balanced across sprints |
