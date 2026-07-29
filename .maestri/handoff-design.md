# SeOrganizeB2B — Design System Specification (Style A: Corporate)

---

## 1. Design Tokens

### 1.1 Color Palette

#### Brand / Primary

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-50` | `#eff6ff` | Light backgrounds, hover fills |
| `--brand-100` | `#dbeafe` | Selection, active fills |
| `--brand-200` | `#bfdbfe` | Borders on brand elements |
| `--brand-300` | `#93c5fd` | Disabled brand elements |
| `--brand-400` | `#60a5fa` | Hover state for primary |
| `--brand-500` | `#2563eb` | **Primary accent — buttons, links, active states** |
| `--brand-600` | `#1d4ed8` | Hover for primary buttons |
| `--brand-700` | `#1e40af` | Active/pressed state |
| `--brand-800` | `#1e3a8a` | Deep brand accents |
| `--brand-900` | `#172554` | Heavy text on light |

#### Neutral / Surface

| Token | Hex | Usage |
|-------|-----|-------|
| `--white` | `#ffffff` | Card backgrounds, panels, modals |
| `--page` | `#f1f5f9` | Page background |
| `--page-alt` | `#f8fafc` | Alternate lighter background |
| `--sidebar` | `#1e293b` | Sidebar background |
| `--sidebar-hover` | `#334155` | Sidebar item hover |
| `--sidebar-active` | `#475569` | Sidebar item active |
| `--sidebar-text` | `#ffffff` | Sidebar primary text |
| `--sidebar-text-muted` | `rgba(255,255,255,0.4)` | Sidebar secondary text |
| `--sidebar-divider` | `rgba(255,255,255,0.1)` | Sidebar dividers |
| `--border` | `#e2e8f0` | Default borders |
| `--border-dark` | `#cbd5e1` | Stronger borders (hover, focus) |

#### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#0f172a` | Main body text |
| `--text-secondary` | `#64748b` | Secondary/label text |
| `--text-muted` | `#94a3b8` | Placeholder, disabled text |
| `--text-inverse` | `#ffffff` | Text on dark backgrounds |

#### Status / Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#16a34a` | Done, complete, green badges |
| `--success-bg` | `#f0fdf4` | Success background |
| `--warning` | `#d97706` | In Progress, amber badges |
| `--warning-bg` | `#fffbeb` | Warning background |
| `--danger` | `#dc2626` | Urgent priority, errors, overdue |
| `--danger-bg` | `#fef2f2` | Danger background |
| `--info` | `#0284c7` | Informational badges |
| `--info-bg` | `#f0f9ff` | Info background |

#### Priority Badge Colors

| Priority | Badge Text | Badge BG | Dot |
|----------|-----------|----------|-----|
| Urgent | `#991b1b` | `#fee2e2` | `#dc2626` |
| High | `#dc2626` | `#fef2f2` | `#dc2626` |
| Medium | `#d97706` | `#fffbeb` | `#d97706` |
| Low | `#6b7280` | `#f3f4f6` | `#9ca3af` |

#### Team Area Identifier Colors

| Area | Dot | Badge BG | Badge Text |
|------|-----|----------|------------|
| Sales | `#3b82f6` (blue) | `#eff6ff` | `#1d4ed8` |
| Engineering | `#10b981` (emerald) | `#ecfdf5` | `#059669` |
| Marketing | `#f97316` (orange) | `#fff7ed` | `#c2410c` |
| Design | `#ec4899` (pink) | `#fdf2f8` | `#be185d` |
| Operations | `#8b5cf6` (purple) | `#f5f3ff` | `#6d28d9` |

---

### 1.2 Typography

#### Font Stack

```
--font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace;
```

#### Type Scale

| Name | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| `display` | 24px / 1.5rem | 700 | 1.3 | -0.02em | Page titles, empty states |
| `heading-1` | 18px / 1.125rem | 600 | 1.4 | -0.01em | Screen headings (Board, Calendar) |
| `heading-2` | 15px / 0.9375rem | 600 | 1.4 | 0 | Column headers, section titles |
| `body` | 14px / 0.875rem | 400 | 1.5 | 0 | Card titles, body text, inputs |
| `body-medium` | 14px / 0.875rem | 500 | 1.5 | 0 | Card titles emphasis |
| `body-small` | 13px / 0.8125rem | 400 | 1.4 | 0 | Metadata, secondary text |
| `caption` | 12px / 0.75rem | 500 | 1.3 | 0 | Badge text, counts, timestamps |
| `label` | 11px / 0.6875rem | 600 | 1.2 | 0.05em | Upper case field labels, section headers |
| `micro` | 10px / 0.625rem | 600 | 1.2 | 0.04em | Task IDs, tag text |

#### Heading / Label Upper Case Convention

Labels use `text-[11px] font-semibold uppercase tracking-wider`. This pattern applies to:
- Form field labels
- Section headings within panels
- Column header metadata

---

### 1.3 Spacing Scale

Base unit: 4px. All spacing follows multiples of 4.

| Token | Pixels | Rem | Usage |
|-------|--------|-----|-------|
| `space-0` | 0px | 0 | Reset |
| `space-1` | 4px | 0.25rem | Tight micro-spacing |
| `space-1.5` | 6px | 0.375rem | Icon-to-text gaps |
| `space-2` | 8px | 0.5rem | Tight element gaps |
| `space-2.5` | 10px | 0.625rem | Avatar-to-text, icon padding |
| `space-3` | 12px | 0.75rem | Default component padding |
| `space-3.5` | 14px | 0.875rem | Card padding |
| `space-4` | 16px | 1rem | Panel padding, grid gaps |
| `space-5` | 20px | 1.25rem | Section padding |
| `space-6` | 24px | 1.5rem | Large section gaps |
| `space-8` | 32px | 2rem | Modal/page padding |
| `space-10` | 40px | 2.5rem | Hero spacing |
| `space-12` | 48px | 3rem | Page section separation |

---

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0px | Brutalist only |
| `radius-sm` | 3px | Checkboxes, small indicators |
| `radius-md` | 4px | Inputs, buttons, small containers |
| `radius-lg` | 6px | Cards, dropdowns, panels |
| `radius-xl` | 8px | Modals, large panels |
| `radius-full` | 9999px | Badges, avatars, pill tags |

---

### 1.5 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | Page backgrounds, flat elements |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Cards, panels |
| `shadow` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Default card |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)` | Dropdowns, elevated cards |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)` | Modals, task detail panel |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.04)` | Toast notifications |

---

## 2. Component Style Guide

### 2.1 Buttons

#### Primary Button
```
bg: var(--brand-500) #2563eb
text: white
font: 13px / 14px, medium (500)
padding: 6px 14px (h: 32px)
border-radius: 6px
hover: bg var(--brand-600) #1d4ed8
active: bg var(--brand-700) #1e40af
disabled: opacity 50%, cursor not-allowed
transition: background-color 150ms ease
icon: 14px, inline with 6px gap
```

#### Secondary Button (Outline)
```
bg: transparent
text: var(--text-secondary) #64748b
border: 1px solid var(--border) #e2e8f0
hover: bg var(--page) #f1f5f9, text var(--text-primary)
same sizes as primary
```

#### Tertiary / Ghost Button
```
bg: transparent
text: var(--text-secondary)
hover: bg rgba(0,0,0,0.04)
no border
same sizes
```

#### Icon Button
```
size: 32px square
bg: transparent
text: var(--text-secondary)
hover: bg var(--page)
border-radius: 6px
icon: 16px centered
```

#### Small Button Variant
```
padding: 4px 10px
font: 12px, medium
height: 26px
Used in: inline actions, compact areas
```

---

### 2.2 Inputs

#### Text Input
```
height: 36px (h-9)
padding: 0 12px
font: 14px, regular
bg: var(--page) or var(--white)
border: 1px solid var(--border)
border-radius: 6px
focus: ring 2px var(--brand-500) (with 3px offset), border var(--brand-500)
placeholder: var(--text-muted)
transition: border-color 150ms, box-shadow 150ms
```

#### Textarea
```
Same as input but multi-line
min-height: 80px
padding: 10px 12px
auto-expand: yes (on long content)
```

#### Select / Dropdown
```
Same dimensions as text input
Custom chevron icon on right
Dropdown panel: bg white, shadow-lg, border, rounded-lg
Option: padding 8px 12px, hover bg var(--page)
```

#### Checkbox
```
size: 14px square
border-radius: 3px
border: 1.5px solid var(--border-dark)
checked: bg var(--brand-500), border var(--brand-500)
accent-color: var(--brand-500) (for native inputs)
label gap: 8px
```

---

### 2.3 Cards

#### Kanban Card
```
bg: white
border: 1px solid var(--border)
border-radius: 8px
padding: 14px
shadow: shadow-sm
spacing inside: 8px between elements
priority badge: top-left
date: top-right
title: 14px, medium, 2 line clamp
metadata row: 12px, secondary, icon+text pairs
hover: border var(--brand-400)
selected: border 2px var(--brand-500)
transition: border-color 150ms, box-shadow 150ms
```

#### Project Card (Projects list)
```
bg: white
border: 1px solid var(--border)
border-radius: 8px
padding: 20px
shadow: shadow-sm
title: 16px, semibold
description: 14px, secondary
stats row: member count, task count, area badge
```

---

### 2.4 Badges & Tags

#### Priority Badge
```
font: 11px, semibold, uppercase
padding: 2px 6px
border-radius: 4px
color per priority table above
No dot when inline — dot only when displayed as list item
```

#### Team Area Badge
```
font: 12px, medium
padding: 4px 10px
border-radius: 999px (pill)
bg + text color per team area color table
or compact: just a 6px colored dot
```

#### Status Badge
```
Same pill style as team area
With colored dot (6px) before text
font: 12px, medium
```

#### Count Badge
```
bg: var(--border) #e2e8f0
text: var(--text-secondary)
font: 12px, medium
border-radius: 999px
padding: 2px 8px
Used: column card counts
```

---

### 2.5 Avatars

```
size: 28px (sidebar), 24px (compact), 36px (profile)
border-radius: 999px (circle)
bg: area-appropriate color or fixed palette
text: 10px (compact) / 12px (default), semibold, white
initials: 2 chars max
```

---

### 2.6 Sidebar

```
width: 240px
bg: var(--sidebar) #1e293b
text: white
border-right: none
layout: flex column, full height
```

#### Sidebar Sections
1. **Logo area** — 56px height, bottom border (white/10)
2. **Project selector** — 16px padding sides, label + dropdown
3. **Navigation** — flex-1, overflow-y-auto, nav items
4. **Team area filters** — label + checkbox list
5. **User info** — bottom, top border separator

#### Nav Items
```
padding: 8px 12px
border-radius: 6px
font: 14px, medium
icon: 16px
gap: 12px icon to text
default: text white/60
hover: bg white/5, text white
active: bg white/10, text white
transition: all 150ms
```

---

### 2.7 Top Bar / Header

```
height: 56px
bg: white
border-bottom: 1px solid var(--border)
padding: 0 20px
layout: flex, items-center, justify-between
```

Left: page title + project badge
Right: search input + primary action button

---

### 2.8 Kanban Board

```
page bg: var(--page)
column min-width: 280px
column gap: 16px
column header: title + count badge + add button
content area: flex-1, overflow-y-auto, scrollbar custom
card spacing: 10px
```

---

### 2.9 Task Detail Panel

```
width: 400px
bg: white
border-left: 1px solid var(--border)
overflow-y: auto
header: 48px, close button, status+id label
sections padding: 20px
section gap: 20px
2-column grid for metadata fields
```

---

### 2.10 Modals

```
overlay: rgba(0,0,0,0.4), backdrop-blur-sm (optional)
modal: bg white, rounded-xl (8px)
width: 480px (default), 640px (large)
max-height: 80vh, overflow-y-auto
padding: 24px
header: title + close, bottom border
footer: actions, right-aligned, gap 8px
enter: scale 95% -> 100%, opacity 0 -> 1, 200ms ease-out
```

---

### 2.11 Toast / Notifications

```
bg: white
border: 1px solid var(--border)
shadow: shadow-xl
border-radius: 8px
padding: 12px 16px
icon: 16px (left)
title: 14px, medium
message: 13px, secondary
position: bottom-right, 24px from edge
max-width: 380px
```

---

### 2.12 Calendar Event Items

```
bg: white
border-left: 3px solid var(--brand-500) (or area color)
padding: 8px 12px
border-radius: 4px
font: 13px
time: 12px, secondary, mono
link to task icon: right side
```

---

### 2.13 Document List Items

```
bg: white
border-bottom: 1px solid var(--border)
padding: 14px 20px
title: 14px, medium
metadata: 12px, secondary, file type + date + area
hover: bg var(--page-alt)
```

---

## 3. Screen Wireframes

### 3.1 Login Screen

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│                    ┌───────────────┐                  │
│                    │               │                  │
│                    │       S       │  Logo mark       │
│                    │               │                  │
│                    └───────────────┘                  │
│                                                       │
│              SeOrganizeB2B                             │
│           Internal Company Organizer                  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                 │  │
│  │  Sign in to your account                        │  │
│  │                                                 │  │
│  │  Email                                          │  │
│  │  ┌───────────────────────────────────────────┐  │  │
│  │  │                                           │  │  │
│  │  └───────────────────────────────────────────┘  │  │
│  │                                                 │  │
│  │  [Continue with Email]                          │  │
│  │                                                 │  │
│  │  ────────────── or ──────────────              │  │
│  │                                                 │  │
│  │  [Sign in with Google]                          │  │
│  │                                                 │  │
│  │  No account? [Create one]                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Footer: © 2026 SeOrganizeB2B                         │
└─────────────────────────────────────────────────────┘

Layout:
- Centered card on the page
- Max-width: 400px
- Page bg: var(--page)
- Card: white, shadow, rounded-xl (8px)
- Logo: 48px square, brand-500 bg, white "S"
- Google button: outlined style
- Email button: primary style
- Spacing: generous, 32px+ between elements
- No sidebar, no top bar
- Responsive: full-width card on mobile with 16px margins
```

### 3.2 Projects List Screen

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar 240px] │  Top Bar: "Projects"  [+ New Project]         │
│                  │────────────────────────────────────────────────│
│                  │                                                │
│                  │ ┌─── Project Card ──────────────────────────┐  │
│                  │ │  Acme Corp Onboarding                      │  │
│                  │ │  Client onboarding pipeline and collateral │  │
│                  │ │  ● Sales  ● 14 tasks  ● 3 members    →    │  │
│                  │ └───────────────────────────────────────────┘  │
│                  │                                                │
│                  │ ┌─── Project Card ──────────────────────────┐  │
│                  │ │  Q3 Product Launch                        │  │
│                  │ │  New product release planning and exec    │  │
│                  │ │  ● Engineering  ● 23 tasks  ● 5 members → │  │
│                  │ └───────────────────────────────────────────┘  │
│                  │                                                │
│                  │ ┌─── Project Card ──────────────────────────┐  │
│                  │ │  Marketing Site Redesign                  │  │
│                  │ │  Complete marketing site overhaul         │  │
│                  │ │  ● Design  ● 9 tasks  ● 2 members    →   │  │
│                  │ └───────────────────────────────────────────┘  │
│                  │                                                │
│                  │ ┌─── Project Card ──────────────────────────┐  │
│                  │ │  Internal Tools                           │  │
│                  │ │  DevOps, CI/CD, and developer tooling     │  │
│                  │ │  ● Engineering  ● 7 tasks  ● 2 members →  │  │
│                  │ └───────────────────────────────────────────┘  │
│                  │                                                │
│                  │ [Empty state when no projects exist]           │
│                  │ ┌─────────────────────────────────────────┐    │
│                  │ │        📋  No projects yet               │    │
│                  │ │    Create your first project to get      │    │
│                  │ │    started organizing your work.         │    │
│                  │ │           [+ Create Project]             │    │
│                  │ └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

Layout:
- Sidebar visible, "Board" nav active or "Projects" in breadcrumb
- Grid of project cards: 2 columns on desktop, 1 on tablet
- Card click → navigates to that project's Kanban board
- "+ New Project" button in top bar → opens create modal
```

### 3.3 Kanban Board Screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar 240px] │  Top Bar: "Board" [Acme Corp Onboarding badge]  [🔍][+] │
│                  │─────────────────────────────────────────────────────────│
│                  │                                                          │
│                  │  ┌── To Do ──┐  ┌── In Progress ──┐  ┌── Done ──────┐  │
│                  │  │ ● 4       │  │ ● 3             │  │ ● 3          │  │
│                  │  │           │  │                  │  │              │  │
│                  │  │ ┌───────┐ │  │ ┌──────────────┐ │  │ ┌──────────┐ │  │
│                  │  │ │HIGH   │ │  │ │HIGH    Jul 29│ │  │ │LOW  Jul20│ │  │
│                  │  │ │Jul 30 │ │  │ │Design hero   │ │  │ │Competitor│ │  │
│                  │  │ │Draft  │ │  │ │● Design ● 3  │ │  │ │● Mktg ●2 │ │  │
│                  │  │ │email  │ │  │ │[SELECTED]    │ │  │ └──────────┘ │  │
│                  │  │ │●Sales │ │  │ └──────────────┘ │  │              │  │
│                  │  │ │● 2    │ │  │ ┌──────────────┐ │  │ ┌──────────┐ │  │
│                  │  │ └───────┘ │  │ │URGENT  Jul 27│ │  │ │HIGH Jul25│ │  │
│                  │  │ ┌───────┐ │  │ │Integrate GCal│ │  │ │Supabase  │ │  │
│                  │  │ │MED    │ │  │ │● Eng ● 5     │ │  │ │● Eng ●1  │ │  │
│                  │  │ │Aug 2  │ │  │ └──────────────┘ │  │ └──────────┘ │  │
│                  │  │ │Budget │ │  │ ┌──────────────┐ │  │ ┌──────────┐ │  │
│                  │  │ │● Ops  │ │  │ │MED    Aug 1  │ │  │ │MED  Jul22│ │  │
│                  │  │ │● 1    │ │  │ │Client pres   │ │  │ │OKRs      │ │  │
│                  │  │ └───────┘ │  │ │● Sales ● 1   │ │  │ │● Ops ●3  │ │  │
│                  │  │ ┌───────┐ │  │ └──────────────┘ │  │ └──────────┘ │  │
│                  │  │ │URGENT │ │  │                  │  │              │  │
│                  │  │ │Jul 28 │ │  │                  │  │              │  │
│                  │  │ │Wirefr.│ │  │                  │  │              │  │
│                  │  │ │●Design│ │  │                  │  │              │  │
│                  │  │ │● 4    │ │  │                  │  │              │  │
│                  │  │ └───────┘ │  │                  │  │              │  │
│                  │  │ ┌───────┐ │  │                  │  │              │  │
│                  │  │ │LOW    │ │  │                  │  │              │  │
│                  │  │ │—      │ │  │                  │  │              │  │
│                  │  │ │CI/CD  │ │  │                  │  │              │  │
│                  │  │ │● Eng  │ │  │                  │  │              │  │
│                  │  │ │● 0    │ │  │                  │  │              │  │
│                  │  │ └───────┘ │  │                  │  │              │  │
│                  │  └───────────┘  └──────────────────┘  └──────────────┘  │
│                  │                                                          │
│                  │  ───[Task Detail Panel 400px]────────────────────       │
│                  │  │ [IP] IN-204    ✕                                │    │
│                  │  │                                                  │    │
│                  │  │ Design new landing page hero                     │    │
│                  │  │ Updated 2 hours ago                              │    │
│                  │  │                                                  │    │
│                  │  │ DESCRIPTION                                     │    │
│                  │  │ Create 3 concepts for the hero section of the   │    │
│                  │  │ new marketing site focusing on the value prop.  │    │
│                  │  │                                                  │    │
│                  │  │ Assignee    │ Priority                           │    │
│                  │  │ [SC] Sarah │ ● High                             │    │
│                  │  │                                                  │    │
│                  │  │ Due Date    │ Team Area                          │    │
│                  │  │ Jul 29,2026│ Design                             │    │
│                  │  │                                                  │    │
│                  │  │ Status      │ Project                            │    │
│                  │  │ ● In Progr.│ Marketing Site Redesign            │    │
│                  │  │                                                  │    │
│                  │  │ [Schedule in Calendar]  [Edit]                  │    │
│                  │  │                                                  │    │
│                  │  │ COMMENTS (3)                                     │    │
│                  │  │ [MK] Mike K.     1h ago                         │    │
│                  │  │      I like the minimalist concept.             │    │
│                  │  │ [SC] Sarah Chen  3h ago                         │    │
│                  │  │      Added first draft to Figma.                │    │
│                  │  │ [JL] Jason L.    Yesterday                      │    │
│                  │  │      Align with brand guidelines.               │    │
│                  │  │                                                  │    │
│                  │  │ [Write a comment...]  [Send]                    │    │
│                  │  └──────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

Layout:
- Full board view with 3 columns (scrollable horizontally if more columns)
- Selected card shows with --brand-500 2px border
- Task detail panel slides in from right, 400px wide
- Panel replaces board width when open (board shrinks)
- Panel has close button → hides panel, board expands
```

### 3.4 Task Detail Modal (Alternative to Panel)

```
┌──────────────────────────────────────────────────────────────────┐
│                           ╔══════════════════════════════════════╗
│                           ║  Task Detail                   [✕]  ║
│                           ║                                      ║
│                           ║  [IP] IN-204                         ║
│                           ║                                      ║
│                           ║  Design new landing page hero       ║
│                           ║  Updated 2 hours ago                 ║
│                           ║                                      ║
│                           ║  ── Description ──                  ║
│                           ║  Create 3 concepts for the hero      ║
│                           ║  section focusing on the value prop.║
│                           ║                                      ║
│                           ║  Assignee   [SC] Sarah Chen          ║
│                           ║  Priority   ● High                   ║
│                           ║  Due Date   Jul 29, 2026             ║
│                           ║  Team Area  Design                   ║
│                           ║  Status     ● In Progress            ║
│                           ║  Project    Marketing Site Redesign  ║
│                           ║                                      ║
│                           ║  [Schedule] [Edit] [Delete]          ║
│                           ║                                      ║
│                           ║  ── Comments (3) ──                 ║
│                           ║  [MK] Mike K.    1h ago             ║
│                           ║       I like the minimalist concept.║
│                           ║  [SC] Sarah Chen 3h ago             ║
│                           ║       Added first draft to Figma.   ║
│                           ║                                      ║
│                           ║  [Write a comment...]     [Send]    ║
│                           ╚══════════════════════════════════════╝
└──────────────────────────────────────────────────────────────────┘

Use: On mobile/tablet, or when panel is too wide for the board layout.
Width: 540px, max-width: 90vw
```

### 3.5 Calendar View

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Top Bar: "Calendar"  [Week ▼]  [<  Jul 27 - Aug 2 >]│
│            │──────────────────────────────────────────────────────│
│            │                                                       │
│            │  ┌─────────────────────────────────────────────────┐  │
│            │  │  Time  │  Mon 27  │  Tue 28  │  Wed 29  │ ... │  │
│            │  ├────────┼──────────┼──────────┼──────────┼─────┤  │
│            │  │  8am   │          │          │          │     │  │
│            │  │        │          │          │          │     │  │
│            │  │  9am   │ ┌──────┐ │          │ ┌──────┐ │     │  │
│            │  │        │ │Team  │ │          │ │Design│ │     │  │
│            │  │  10am  │ │Standup│ │          │ │Review│ │     │  │
│            │  │        │ └──────┘ │          │ └──────┘ │     │  │
│            │  │  11am  │          │ ┌──────┐ │          │     │  │
│            │  │        │          │ │Client│ │          │     │  │
│            │  │  12pm  │ [Lunch]  │ │Call  │ │          │     │  │
│            │  │        │          │ └──────┘ │          │     │  │
│            │  │  1pm   │          │          │          │     │  │
│            │  │        │          │          │ ┌──────┐ │     │  │
│            │  │  2pm   │ ┌──────┐ │          │ │Hero  │ │     │  │
│            │  │        │ │Wire  │ │          │ │Design│ │     │  │
│            │  │  3pm   │ │frame │ │          │ └──────┘ │     │  │
│            │  │        │ └──────┘ │          │          │     │  │
│            │  │  4pm   │          │ ┌──────┐ │          │     │  │
│            │  │        │          │ │Deep  │ │          │     │  │
│            │  │  5pm   │          │ │Work  │ │          │     │  │
│            │  │        │          │ └──────┘ │          │     │  │
│            │  └────────┴──────────┴──────────┴──────────┴─────┘  │
│            │                                                       │
│            │  ┌── Side Panel: Upcoming Tasks ─────────────────┐   │
│            │  │  🔴 Draft email sequence          Jul 30     │   │
│            │  │  🟡 Review budget proposal        Aug 2      │   │
│            │  │  🔴 Design hero (scheduled Wed)   Jul 29     │   │
│            │  │  🟢 Set up Supabase               Jul 25 ✓   │   │
│            │  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

Layout:
- Weekly view by default (toggle: day / week / month)
- Events from Google Calendar API shown in time slots
- Tasks with due dates shown below calendar or as overlay
- Task overlay uses priority colors for left border
- Click event → opens detail
- "Schedule task" flow opens a create-event modal
```

### 3.6 Documents List

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Top Bar: "Documents"  [Filter: All ▼]  [+ New Doc]  │
│            │──────────────────────────────────────────────────────│
│            │                                                       │
│            │  ┌── Folder / Project Filter ─────────────────────┐  │
│            │  │  All Documents  │  Acme Corp  │  Q3 Launch │...│  │
│            │  └─────────────────────────────────────────────────┘  │
│            │                                                       │
│            │  ┌── Document List ───────────────────────────────┐  │
│            │  │ 📄 Meeting Notes - Q3 Kickoff                  │  │
│            │  │  .md · Updated 2h ago · Acme Corp Onboarding   │  │
│            │  ├────────────────────────────────────────────────┤  │
│            │  │ 📄 Design System Architecture                  │  │
│            │  │  .md · Updated 1d ago · Marketing Site Redesign│  │
│            │  ├────────────────────────────────────────────────┤  │
│            │  │ 📄 Competitor Analysis Report                  │  │
│            │  │  .md · Updated 3d ago · Internal Tools         │  │
│            │  ├────────────────────────────────────────────────┤  │
│            │  │ 📄 Onboarding Checklist                        │  │
│            │  │  .md · Updated 1w ago · Acme Corp Onboarding   │  │
│            │  ├────────────────────────────────────────────────┤  │
│            │  │ 📄 Sprint Retro - Week 4                       │  │
│            │  │  .md · Updated 1w ago · Q3 Product Launch      │  │
│            │  └────────────────────────────────────────────────┘  │
│            │                                                       │
│            │  [Empty state]                                        │
│            │  ┌──────────────────────────────────────────────┐    │
│            │  │         📝  No documents yet                  │    │
│            │  │  Create your first document to capture notes, │    │
│            │  │  specs, and meeting minutes.                  │    │
│            │  │            [+ New Document]                   │    │
│            │  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

Layout:
- Filter tabs below top bar
- List view: each row is 56px height, clear file icon + title + metadata
- Click → opens document editor view
- Right side or new page for the editor
```

### 3.7 Document Editor

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar] │  Top Bar: "Documents"  [Meeting Notes - Q3 Kickoff]  │
│            │ [← Back to Documents]  [Save]  [Link to Project ▼]  │
│            │──────────────────────────────────────────────────────│
│            │                                                       │
│            │  ┌── Editor Area ────────────────────────────────┐  │
│            │  │  ┌─ Title ──────────────────────────────────┐  │  │
│            │  │  │  Meeting Notes - Q3 Kickoff              │  │  │
│            │  │  └──────────────────────────────────────────┘  │  │
│            │  │                                                 │  │
│            │  │  ┌─ Split Layout ────────────────────────────┐  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  Markdown Editor (left)                 │  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  # Q3 Kickoff Meeting                   │  │  │
│            │  │  │  │                                         │  │  │
│            │  │  │  │  **Date:** July 27, 2026                │  │  │
│            │  │  │  │  **Attendees:** Guilherme, Sarah, Mike  │  │  │
│            │  │  │  │                                         │  │  │
│            │  │  │  │  ## Agenda                              │  │  │
│            │  │  │  │  1. Q3 Goals review                     │  │  │
│            │  │  │  │  2. Resource allocation                  │  │  │
│            │  │  │  │  3. Timeline milestones                  │  │  │
│            │  │  │  │  4. Action items                         │  │  │
│            │  │  │  │                                         │  │  │
│            │  │  │  │  ## Notes                               │  │  │
│            │  │  │  │  - Revenue target: $2M ARR              │  │  │
│            │  │  │  │  - New hire: 2 engineers by Sep         │  │  │
│            │  │  │  │  - Key milestone: Beta launch Aug 15    │  │  │
│            │  │  ├────────────────────────────────────────────┤  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  Preview (right)                        │  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  Q3 Kickoff Meeting                    │  │  │
│            │  │  │  │  ═══════════════                       │  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  Date: July 27, 2026                   │  │  │
│            │  │  │  │  Attendees: Guilherme, Sarah, Mike     │  │  │
│            │  │  │  │                                        │  │  │
│            │  │  │  │  Agenda                                │  │  │
│            │  │  │  │  ──────                                │  │  │
│            │  │  │  │  1. Q3 Goals review                    │  │  │
│            │  │  │  │  2. Resource allocation                 │  │  │
│            │  │  │  │  3. Timeline milestones                 │  │  │
│            │  │  │  │  4. Action items                        │  │  │
│            │  │  └────────────────────────────────────────────┘  │  │
│            │  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Layout:
- Full-height editor
- Title field at top (18px, semibold)
- Split pane: markdown textarea (left) + rendered preview (right)
- 50/50 split by default, can be toggled to editor-only or preview-only
- Toolbar: bold, italic, heading, list, link buttons (optional for v1)
- Save button in top bar: saves to Supabase
- "Link to Project" dropdown: associates doc with a project
```

### 3.8 Settings / Team Areas Management

```
┌──────────────────────────────────────────────────────────────────┐
│ [Sidebar: Settings active] │  Top Bar: "Settings"                │
│                             │─────────────────────────────────────│
│                             │                                     │
│                             │  ┌─ Settings Nav ──────────────┐   │
│                             │  │  Profile                     │   │
│                             │  │  Team Areas ◄              │   │
│                             │  │  Integrations                │   │
│                             │  │  Preferences                 │   │
│                             │  └──────────────────────────────┘   │
│                             │                                     │
│                             │  ┌─ Team Areas ──────────────────┐  │
│                             │  │  [+ Add Area]                 │  │
│                             │  │                                │  │
│                             │  │  ┌── Area List ────────────┐  │  │
│                             │  │  │                          │  │  │
│                             │  │  │ Sales                    │  │  │
│                             │  │  │ 3 members · 12 tasks     │  │  │
│                             │  │  │ [Edit] [Delete]          │  │  │
│                             │  │  ├──────────────────────────┤  │  │
│                             │  │  │ Engineering              │  │  │
│                             │  │  │ 2 members · 18 tasks     │  │  │
│                             │  │  │ [Edit] [Delete]          │  │  │
│                             │  │  ├──────────────────────────┤  │  │
│                             │  │  │ Marketing                │  │  │
│                             │  │  │ 1 member · 7 tasks       │  │  │
│                             │  │  │ [Edit] [Delete]          │  │  │
│                             │  │  ├──────────────────────────┤  │  │
│                             │  │  │ Design                   │  │  │
│                             │  │  │ 2 members · 9 tasks      │  │  │
│                             │  │  │ [Edit] [Delete]          │  │  │
│                             │  │  ├──────────────────────────┤  │  │
│                             │  │  │ Operations               │  │  │
│                             │  │  │ 1 member · 5 tasks       │  │  │
│                             │  │  │ [Edit] [Delete]          │  │  │
│                             │  │  └──────────────────────────┘  │  │
│                             │  └────────────────────────────────┘  │
│                             │                                     │
│                             │  ┌── Add / Edit Area Modal ──────┐  │
│                             │  │  ┌──────────────────────────┐  │  │
│                             │  │  │  Area Name               │  │  │
│                             │  │  │  [____________________]  │  │  │
│                             │  │  └──────────────────────────┘  │  │
│                             │  │  [Cancel]  [Save]              │  │  │
│                             │  └────────────────────────────────┘  │
│                             │                                     │
│                             │  ┌── Delete Confirmation ─────────┐ │
│                             │  │  Delete "Design"?             │  │
│                             │  │  This area has 2 members and  │  │
│                             │  │  9 tasks assigned. These      │  │
│                             │  │  tasks will show as           │  │
│                             │  │  "Unassigned Area."            │  │
│                             │  │  [Cancel]  [Delete Area]      │  │
│                             │  └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

Layout:
- Settings sidebar nav (second-level, narrower than main sidebar)
- Content area with white card sections
- Table-like list for team areas
- Inline edit: click edit icon on a row → inline edit or modal
- Delete: always shows confirmation modal with impact warning
```

---

## 4. Component Tree

```
App
├── AuthGate (login/signup routing)
│   └── LoginScreen
│       ├── LogoMark
│       ├── LoginCard
│       │   ├── EmailInput
│       │   ├── PrimaryButton ("Continue with Email")
│       │   ├── DividerWithText ("or")
│       │   └── GoogleButton
│       └── Footer
│
├── AppLayout (authenticated)
│   ├── Sidebar
│   │   ├── Logo
│   │   ├── ProjectSelector (dropdown)
│   │   │   └── ProjectOption[]
│   │   ├── NavMenu
│   │   │   ├── NavItem (Board)
│   │   │   ├── NavItem (Calendar)
│   │   │   ├── NavItem (Documents)
│   │   │   └── NavItem (Settings)
│   │   ├── TeamAreaFilter
│   │   │   └── AreaCheckbox[]
│   │   └── UserInfo
│   │       ├── Avatar
│   │       ├── UserName
│   │       └── UserEmail
│   │
│   ├── TopBar
│   │   ├── PageTitle
│   │   ├── ProjectBadge
│   │   ├── SearchInput
│   │   └── ActionButton (e.g. "New Task")
│   │
│   └── MainContent
│       │
│       ├── ProjectsListScreen
│       │   ├── ProjectGrid
│       │   │   └── ProjectCard[]
│       │   │       ├── ProjectTitle
│       │   │       ├── ProjectDescription
│       │   │       ├── AreaBadge
│       │   │       ├── StatRow (tasks, members)
│       │   │       └── ChevronLink
│       │   └── EmptyState
│       │
│       ├── KanbanBoardScreen
│       │   ├── Column[]
│       │   │   ├── ColumnHeader
│       │   │   │   ├── ColumnTitle
│       │   │   │   ├── CountBadge
│       │   │   │   └── AddButton (ghost)
│       │   │   └── CardList (droppable)
│       │   │       └── KanbanCard[] (draggable)
│       │   │           ├── PriorityBadge
│       │   │           ├── DueDateText
│       │   │           ├── CardTitle
│       │   │           ├── AreaDot + Label
│       │   │           └── CommentCount
│       │   ├── TaskDetailPanel
│       │   │   ├── PanelHeader (status badge + id + close)
│       │   │   ├── TaskTitle
│       │   │   ├── DescriptionSection
│       │   │   ├── MetadataGrid
│       │   │   │   ├── MetadataField (Assignee with Avatar)
│       │   │   │   ├── MetadataField (Priority with dot)
│       │   │   │   ├── MetadataField (Due Date)
│       │   │   │   ├── MetadataField (Team Area)
│       │   │   │   ├── MetadataField (Status with dot)
│       │   │   │   └── MetadataField (Project)
│       │   │   ├── ActionRow
│       │   │   │   ├── PrimaryButton (Schedule in Calendar)
│       │   │   │   └── SecondaryButton (Edit)
│       │   │   └── CommentsSection
│       │   │       ├── CommentItem[]
│       │   │       │   ├── Avatar
│       │   │       │   ├── CommentAuthor + Timestamp
│       │   │       │   └── CommentBody
│       │   │       └── CommentInput (text + send button)
│       │   └── TaskDetailModal (mobile/tablet alternative)
│       │
│       ├── CalendarScreen
│       │   ├── CalendarToolbar (view toggle + date nav)
│       │   ├── CalendarGrid (day/week/month)
│       │   │   └── CalendarEvent[]
│       │   │       ├── EventTime
│       │   │       ├── EventTitle
│       │   │       └── TaskLinkIcon
│       │   ├── UpcomingTasksPanel
│       │   │   └── TaskItem[]
│       │   └── ScheduleEventModal (from task)
│       │
│       ├── DocumentsListScreen
│       │   ├── ProjectFilterTabs
│       │   ├── DocumentList
│       │   │   └── DocumentRow[]
│       │   │       ├── FileIcon
│       │   │       ├── DocumentTitle
│       │   │       ├── Metadata (type + date + project)
│       │   │       └── ChevronLink
│       │   └── EmptyState
│       │
│       ├── DocumentEditorScreen
│       │   ├── EditorToolbar
│       │   │   ├── BackButton
│       │   │   ├── SaveButton
│       │   │   └── ProjectLinkDropdown
│       │   ├── DocumentTitleInput
│       │   ├── SplitPane
│       │   │   ├── MarkdownEditor (textarea/CodeMirror)
│       │   │   └── MarkdownPreview (rendered)
│       │   └── ViewToggle (edit/preview/split)
│       │
│       └── SettingsScreen
│           ├── SettingsNav
│           │   └── SettingsNavItem[]
│           ├── TeamAreasSection
│           │   ├── AddAreaButton
│           │   ├── AreaList
│           │   │   └── AreaRow[]
│           │   │       ├── AreaName
│           │   │       ├── AreaStats
│           │   │       ├── EditButton
│           │   │       └── DeleteButton
│           │   ├── AddEditAreaModal
│           │   └── DeleteConfirmModal
│           └── ProfileSection (future)
│
├── Shared / Reusable
│   ├── Button (primary / secondary / ghost / icon / sizes)
│   ├── Input (text / textarea / select / checkbox)
│   ├── Badge (priority / area / status / count)
│   ├── Avatar (with initials)
│   ├── Modal (overlay + container + header + body + footer)
│   ├── Toast (success / error / info)
│   ├── Tooltip
│   ├── Dropdown (project selector, filter menus)
│   ├── EmptyState (icon + title + description + CTA)
│   ├── Spinner / LoadingState
│   └── ErrorBoundary
```

---

## 5. Responsive Behavior Rules

### 5.1 Breakpoints

| Name | Min Width | Target |
|------|-----------|--------|
| Mobile | 0–639px | Phone portrait |
| Tablet | 640–1023px | Tablet portrait/landscape |
| Desktop | 1024–1279px | Small desktop |
| Wide | 1280px+ | Large desktop |

### 5.2 Layout Adaptation

#### Desktop (1024px+)
```
Sidebar: 240px, always visible
Top bar: full width minus sidebar
Main content: full remaining width
Task detail: 400px panel alongside board
Kanban columns: 3 visible side by side
Calendar: full week grid visible
Editor: split pane 50/50
Settings: sidebar nav + content
```

#### Tablet (640–1023px)
```
Sidebar: collapses to icon-only (64px wide) or hidden with hamburger toggle
Top bar: full width, hamburger menu left
Main content: full width
Task detail: slides up as bottom sheet or modal instead of side panel
Kanban columns: horizontal scroll, 1.5 columns visible at a time
Calendar: day view default, toggleable
Editor: stacked (editor top, preview bottom) or tab-switched
Settings: full-width content, settings nav as horizontal tabs
```

#### Mobile (<640px)
```
Sidebar: hidden by default, overlay drawer triggered by hamburger
Top bar: minimal, just title + hamburger + primary action
Main content: full width, single column
Task detail: full-screen modal, swipe to close
Kanban: single column at a time, swipe horizontally to switch columns
Calendar: day view only
Documents: list view, full width rows
Editor: editor or preview, toggle with tab (no split)
Modals: full-screen sheet style, close at top
All panels: no fixed widths, use 100% width
Buttons: larger touch targets (min 44px height)
Inputs: full width
```

### 5.3 Specific Component Responsive Rules

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| Sidebar | 240px fixed | 64px retracted or hidden | Hidden (drawer) |
| Top bar search | 224px | 160px or icon only | Icon only |
| Kanban column | min 280px, flex equal | min 260px, scroll | 100vw snap |
| Task detail | 400px side panel | 480px modal | Full screen modal |
| Project cards | 2 columns | 1 column | 1 column |
| Calendar events | Compact, show title | Show title | Show time only |
| Document editor | Side-by-side split | Stacked | Tab toggle |
| Settings nav | Left sidebar | Top tabs | Top tabs scroll |
| Button sizes | md (32px h) | md (32px h) | lg (44px h) |
| Spacing | 16–20px | 12–16px | 12px |

---

## 6. Accessibility Guidelines

### 6.1 Color Contrast

All text/background combinations must meet WCAG 2.1 AA:

| Combination | Ratio | Passes AA? |
|-------------|-------|-----------|
| Text primary (#0f172a) on page (#f1f5f9) | 12.5:1 | ✅ AAA |
| Text secondary (#64748b) on white (#fff) | 4.6:1 | ✅ AA |
| Text secondary on page (#f1f5f9) | 5.8:1 | ✅ AA |
| White text (#fff) on sidebar (#1e293b) | 11.5:1 | ✅ AAA |
| White/40 text on sidebar (#1e293b) | 4.8:1 | ✅ AA |
| Brand-500 (#2563eb) on white (#fff) | 4.3:1 | ✅ AA |
| White text on brand-500 (#2563eb) | 4.3:1 | ✅ AA |

### 6.2 Focus States

```
All interactive elements:
  outline: 2px solid var(--brand-500)
  outline-offset: 2px
  border-radius: match element

Exception: mouse users should not see focus rings
  .focus-visible:focus-visible { outline: 2px solid brand-500; }
  .focus-visible:focus:not(:focus-visible) { outline: none; }
```

### 6.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move forward through interactive elements in logical order |
| Shift+Tab | Move backward |
| Enter/Space | Activate focused button, link, or control |
| Escape | Close modal, panel, dropdown, or toast |
| Arrow Down | Open dropdown, move down in list |
| Arrow Up | Move up in list |
| Arrow Left/Right | Navigate Kanban columns, calendar days |
| Ctrl+K | Focus search (Cmd+K on Mac) |
| / | Focus search (when not in an input) |

**Tab order priority per screen:**
1. Skip to content link (first focusable element)
2. Primary action button
3. Main navigation
4. Search
5. Content area (cards, list items)
6. Secondary actions
7. Sidebar filters

### 6.4 ARIA Roles & Labels

| Element | ARIA |
|---------|------|
| Sidebar | `role="navigation"` or `<nav>` with `aria-label="Main navigation"` |
| Top bar search | `role="search"` or `<search>` |
| Kanban board | `role="list"` with `aria-label="Task board"` |
| Kanban column | `role="listitem"` with `aria-label="[Column Name] column, [N] tasks"` |
| Kanban card (draggable) | `role="button"`, `aria-grabbed="false"`, `aria-describedby="card-id"`, `tabindex="0"` |
| Task detail panel | `role="dialog"`, `aria-modal="true"`, `aria-label="Task detail for [Task Name]"` |
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title-id"` |
| Toast | `role="alert"`, `aria-live="polite"` |
| Tab panels | `role="tablist"`, `role="tab"`, `role="tabpanel"` with `aria-selected` |
| Dropdown | `aria-haspopup="listbox"`, `aria-expanded="true/false"` |
| Badge (non-interactive) | `aria-label="Priority: High"` or similar |
| Avatar | `aria-label="[User name]"` or `role="img"` with `aria-label` |
| Loading state | `aria-busy="true"` on container |
| Error messages | `role="alert"` connected to input via `aria-describedby` |
| Empty state | `aria-label="No items"` on the container |

### 6.5 Screen Reader Considerations

- All icons must have either `aria-hidden="true"` (decorative) or `aria-label` (informative)
- SVG icons should include `<title>` for informative icons, `focusable="false"` for all
- Status changes (task moved, comment added) should announce via a live region
- Drag and drop must have a keyboard alternative (move up/down buttons or context menu)
- Column counts should be announced as "4 tasks in To Do column"
- Overdue tasks should have an additional `aria-label` indicating they are overdue
- Calendar events should announce time and title together

### 6.6 Touch Targets

- Minimum: 44×44px (WCAG 2.2)
- Used for: all interactive elements on mobile (buttons, links, inputs)
- Desktop minimum: 32×32px
- Exception: inline icons within text (e.g., comment count) with 28px touch area

### 6.7 Motion & Animation

- All animations must respect `prefers-reduced-motion`
- Default: transitions at 150–200ms
- Modals: 200ms ease-out (enter), 150ms ease-in (exit)
- Panel slide: 250ms ease
- Drag feedback: 100ms
- No auto-playing animations
- Loading spinners: CSS animation, no flash

---

## 7. Implementation Notes

### Tailwind Config Extension

```js
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        sidebar: '#1e293b',
        page: '#f1f5f9',
        'page-alt': '#f8fafc',
        accent: '#2563eb',
        'accent-hover': '#1d4ed8',
        'accent-light': '#eff6ff',
        'text-primary': '#0f172a',
        'text-secondary': '#64748b',
        'text-muted': '#94a3b8',
        border: '#e2e8f0',
        'border-dark': '#cbd5e1',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
}
```

### HTML Structure Pattern

```html
<body class="bg-page text-text-primary antialiased flex h-screen overflow-hidden">
  <!-- Sidebar -->
  <aside class="w-[240px] min-w-[240px] bg-sidebar text-white flex flex-col h-screen shrink-0">
    ...
  </aside>

  <!-- Main area -->
  <div class="flex-1 flex flex-col min-w-0">

    <!-- Top bar -->
    <header class="h-14 bg-white border-b border-border flex items-center shrink-0 px-5">
      ...
    </header>

    <!-- Content -->
    <div class="flex-1 flex min-h-0">
      ...
    </div>
  </div>
</body>
```

### Data Attributes for Testing

```html
data-testid="sidebar"
data-testid="kanban-column-{name}"
data-testid="task-card-{id}"
data-testid="task-detail-panel"
data-testid="modal-{name}"
data-testid="toast"
data-testid="comment-input"
data-testid="project-selector"
```

---
