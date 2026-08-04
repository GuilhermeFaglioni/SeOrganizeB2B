# Settings UI and i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonize the authenticated Settings surface and make all Settings and role-permission labels resolve correctly in Portuguese and English.

**Architecture:** Add a small presentational Settings shell with shared page header, back link, section, and overview-card primitives. Keep page data fetching and mutations in existing routes. Reshape only the role-permission message objects so existing permission IDs remain unchanged while `next-intl` receives nested namespaces.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, next-intl, Radix Dialog, Vitest.

---

### Task 1: Lock the i18n contract

**Files:**
- Modify: `messages/pt-BR.json:1256-1286`
- Modify: `messages/en.json:1256-1286`
- Modify: `src/__tests__/i18n-integrity.test.ts`

- [ ] **Step 1: Add a failing assertion for nested permission labels**

Add this test inside the existing `describe("i18n integrity", ...)`:

```ts
it("keeps role permission labels nested for dotted permission ids", () => {
  const ptPermissions = (ptBR.roles as any).permissions;
  const enPermissions = (en.roles as any).permissions;

  expect(ptPermissions.modules.financial.overview).toBe("Financeiro — Visão geral");
  expect(enPermissions.modules.financial.overview).toBe("Financial — Overview");
  expect(ptPermissions.special.financial.contracts.lifecycle).toBe("Ciclo de vida de contratos");
  expect(enPermissions.special.financial.contracts.lifecycle).toBe("Contract lifecycle");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run src/__tests__/i18n-integrity.test.ts`

Expected: FAIL because `modules.financial` and `special.financial` are currently literal dotted keys.

- [ ] **Step 3: Nest the module messages in both locales**

Replace the five literal module properties with:

```json
"financial": {
  "overview": "...",
  "contracts": "...",
  "proposals": "...",
  "clients": "...",
  "receivables": "..."
}
```

Use the existing Portuguese and English strings unchanged.

- [ ] **Step 4: Nest dotted special-permission messages in both locales**

Replace the dotted special properties with nested objects:

```json
"financial": {
  "contracts": {
    "lifecycle": "...",
    "adjustValue": "..."
  },
  "receivables": {
    "markPaid": "...",
    "refund": "..."
  },
  "proposals": {
    "send": "...",
    "acceptReject": "...",
    "clone": "...",
    "manageTemplates": "..."
  }
}
```

Keep `manage_roles` as a direct property because its ID has no dot.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- --run src/__tests__/i18n-integrity.test.ts`

Expected: PASS with all existing parity checks green.

- [ ] **Step 6: Commit the i18n slice**

```bash
git add messages/pt-BR.json messages/en.json src/__tests__/i18n-integrity.test.ts
git commit -m "fix(i18n): resolve dotted role permission labels"
```

### Task 2: Add shared Settings layout primitives

**Files:**
- Create: `src/components/settings/settings-shell.tsx`
- Create: `src/__tests__/settings-ui.test.ts`

- [ ] **Step 1: Add a failing source contract test**

Assert that the shared shell exposes `SettingsShell`, `SettingsHeader`, `SettingsSection`, and `SettingsBackLink`, and that the shell includes `max-w-5xl` and responsive horizontal padding.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run src/__tests__/settings-ui.test.ts`

Expected: FAIL because the shared file does not exist.

- [ ] **Step 3: Implement the presentational primitives**

Implement these pure components:

```tsx
export function SettingsShell({ children, testId }: { children: ReactNode; testId?: string }) {
  return <div data-testid={testId} className="min-h-full px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-5xl space-y-8">{children}</div></div>;
}
```

Add `SettingsBackLink` using `next/link` and `ArrowLeft`, `SettingsHeader` with title/description/action, and `SettingsSection` with optional title/description and consistent border/background/padding.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --run src/__tests__/settings-ui.test.ts`

Expected: PASS.

### Task 3: Migrate Settings pages to the shared rhythm

**Files:**
- Modify: `src/app/(authenticated)/settings/page.tsx`
- Modify: `src/app/(authenticated)/settings/profile/page.tsx`
- Modify: `src/app/(authenticated)/settings/team/page.tsx`
- Modify: `src/app/(authenticated)/settings/areas/page.tsx`
- Modify: `src/app/(authenticated)/settings/workspace/page.tsx`
- Modify: `src/app/(authenticated)/settings/roles/page.tsx`
- Modify: `src/components/settings/roles-manager.tsx`

- [ ] **Step 1: Replace page-local outer wrappers**

Use `SettingsShell`, `SettingsHeader`, `SettingsBackLink`, and `SettingsSection` while preserving existing hooks, mutation handlers, permission checks, and test IDs.

- [ ] **Step 2: Harmonize the overview cards**

Use a responsive `sm:grid-cols-2` layout, consistent icon/title/description alignment, keyboard-accessible `Link` cards, and the existing accent only for the leading icon and hover state.

- [ ] **Step 3: Harmonize forms and lists**

Use the shared section surface for profile/workspace forms and consistent row spacing for team and areas. Preserve all existing labels and translated states.

- [ ] **Step 4: Convert the role editor to Radix Dialog layout**

Keep the current state and submit behavior, but render the editor in `DialogContent` with a constrained viewport, scrollable permission body, and non-scrolling footer containing Cancel/Save. Existing `Dialog` primitives provide focus management and Escape handling.

- [ ] **Step 5: Run Settings-focused tests**

Run: `npm test -- --run src/__tests__/settings-ui.test.ts src/__tests__/i18n-integrity.test.ts src/__tests__/authz-ui.test.ts`

Expected: PASS.

### Task 4: Full verification and PR

**Files:**
- Verify all modified files from Tasks 1-3.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint`

Run: `npx tsc --noEmit`

Expected: no lint errors and no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js build succeeds and all application routes compile.

- [ ] **Step 4: Review the final diff**

Run: `git status --short`, `git diff --stat origin/main...HEAD`, and `git diff --check`.

Confirm no API, Prisma migration, or unrelated files changed.

- [ ] **Step 5: Commit, push, and open the PR**

Use Conventional Commit messages per logical slice, push `fix/settings-ui-i18n`, and open a PR against `main` with the test commands and the note that validation is required after deployment.
