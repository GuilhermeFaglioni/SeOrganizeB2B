# Financial Module — Task 17

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 17: Add Responsive and Accessible States

**Files:**
- Modify: `src/components/financial/overview/overview-page.tsx`
- Modify: `src/components/financial/contracts/contract-list.tsx`
- Modify: `src/components/financial/receivables/receivables-list.tsx`
- Modify: `src/components/financial/clients/client-list.tsx`
- Modify: `src/components/financial/shared/kpi-card.tsx`
- Create: `src/__tests__/financial-responsiveness.test.ts`

- [ ] **Step 1: Write the failing responsiveness contract test**

Create `src/__tests__/financial-responsiveness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial responsiveness and accessibility", () => {
  it("wraps tables in horizontal scroll containers", () => {
    for (const file of [
      "src/components/financial/contracts/contract-list.tsx",
      "src/components/financial/receivables/receivables-list.tsx",
      "src/components/financial/clients/client-list.tsx",
      "src/components/financial/contracts/contract-detail.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("overflow-x-auto");
      expect(source).toContain("min-w-[");
    }
  });

  it("uses responsive KPI grids that collapse on mobile", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("grid-cols-1");
    expect(overview).toContain("sm:grid-cols-2");
    expect(overview).toContain("xl:grid-cols-4");
  });

  it("labels every filter input and search field", () => {
    const filters = read("src/components/financial/overview/financial-filters.tsx");
    expect(filters).toContain("<label");
    const search = read("src/components/financial/contracts/contract-search-filters.tsx");
    expect(search).toContain('htmlFor="contract-search"');
  });

  it("keeps 44px minimum touch targets on controls", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain("min-h-[44px]");
    const csv = read("src/components/financial/contracts/csv-export-button.tsx");
    expect(csv).toContain("min-h-[44px]");
  });

  it("associates semantic labels and announces list state", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("scope=\"col\"");
    expect(list).toContain("<caption");
    const pagination = read("src/components/financial/contracts/pagination.tsx");
    expect(pagination).toContain("aria-live");
    expect(pagination).toContain('aria-label="Previous page"');
  });

  it("renders loading, empty, error and validation feedback states", () => {
    const overview = read("src/components/financial/overview/overview-page.tsx");
    expect(overview).toContain("LoadingState");
    expect(overview).toContain("FinancialEmptyState");
    expect(overview).toContain("FinancialErrorState");
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("role=\"alert\"");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-responsiveness.test.ts
```

Expected: FAIL — several components are missing the required classes and
semantics.

- [ ] **Step 3: Harden the KPI card with visible focus and progress sizing**

In `src/components/financial/shared/kpi-card.tsx`, change the outer div to
accept an `id` and keep the grid classes in the caller. Add an `aria-live`
region wrapper in `overview-page.tsx` around the KPI grid:

```tsx
<div
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
  aria-live="polite"
  aria-label="Financial key performance indicators"
>
```

- [ ] **Step 4: Add global filter wiring to the overview page**

In `src/components/financial/overview/overview-page.tsx`, re-add the
`useProjects` and `useClients` queries (removed in Task 13) and add client,
project, contract-status and installment-status selects below
`FinancialFilters`:

```tsx
import { useProjects } from "@/hooks/use-projects";
import { useClients } from "@/hooks/use-clients";
```

Inside `OverviewPage`, after the `useOverview(filters)` call, add:

```tsx
  const { data: projects } = useProjects();
  const { data: clientsData } = useClients({ pageSize: 100 });
```

Then render the global filter selects below `FinancialFilters`:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-text-secondary">
          Client
          <select
            value={filters.clientId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clientsData?.items.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Project
          <select
            value={filters.projectId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All projects</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Contract status
          <select
            value={filters.contractStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, contractStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {["draft", "active", "closed", "cancelled", "suspended"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          Installment status
          <select
            value={filters.installmentStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, installmentStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All installments</option>
            {["pending", "paid", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
```

This makes the global filters affect the KPIs, chart and lists together, as
the spec requires.

- [ ] **Step 5: Add focus-visible rings and empty search handling**

In `src/components/financial/contracts/contract-search-filters.tsx`, add
`focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none` to
the search input and selects. In `contract-list.tsx`, when the server returns
zero rows for a non-empty search, keep the empty state but also surface a hint
matching the search term.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-responsiveness.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the full financial suite and typecheck**

```bash
npx vitest run src/__tests__/financial-schema.test.ts src/__tests__/financial-money.test.ts src/__tests__/financial-installments.test.ts src/__tests__/financial-metrics.test.ts src/__tests__/financial-lifecycle.test.ts src/__tests__/financial-services.test.ts src/__tests__/financial-clients-api.test.ts src/__tests__/financial-contracts-api.test.ts src/__tests__/financial-operations-api.test.ts src/__tests__/financial-overview-api.test.ts src/__tests__/financial-exports.test.ts src/__tests__/financial-hooks.test.ts src/__tests__/financial-overview-ui.test.ts src/__tests__/financial-contracts-ui.test.ts src/__tests__/financial-receivables-ui.test.ts src/__tests__/financial-clients-ui.test.ts src/__tests__/financial-responsiveness.test.ts
npx tsc --noEmit --incremental false
```

Expected: all PASS and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/financial/overview/overview-page.tsx src/components/financial/contracts/contract-list.tsx src/components/financial/receivables/receivables-list.tsx src/components/financial/clients/client-list.tsx src/components/financial/shared/kpi-card.tsx src/__tests__/financial-responsiveness.test.ts
git commit -m "feat(financial): add responsive and accessible states"
```

---

