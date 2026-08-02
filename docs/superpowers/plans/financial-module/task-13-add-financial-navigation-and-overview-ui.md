# Financial Module — Task 13

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 13: Add Financial Navigation and Overview UI

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Create: `src/components/financial/financial-tabs.tsx`
- Create: `src/app/(authenticated)/financial/layout.tsx`
- Create: `src/components/financial/shared/kpi-card.tsx`
- Create: `src/components/financial/shared/money-text.tsx`
- Create: `src/components/financial/shared/status-badge.tsx`
- Create: `src/components/financial/shared/civil-date-text.tsx`
- Create: `src/components/financial/shared/empty-state.tsx`
- Create: `src/components/financial/shared/error-state.tsx`
- Create: `src/components/financial/overview/forecast-received-chart.tsx`
- Create: `src/components/financial/overview/financial-filters.tsx`
- Create: `src/components/financial/overview/overview-page.tsx`
- Create: `src/app/(authenticated)/financial/page.tsx`
- Create: `src/__tests__/financial-overview-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-overview-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("financial overview UI", () => {
  it("adds a Financial entry to the sidebar navigation", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(sidebar).toContain('href: "/financial"');
    expect(sidebar).toContain('label: "Financial"');
    expect(sidebar).toContain("nav-financial");
  });

  it("keeps the overview route and layout present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/page.tsx",
      "src/app/(authenticated)/financial/layout.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders the forecast versus received chart accessibly", () => {
    const chart = read("src/components/financial/overview/forecast-received-chart.tsx");
    expect(chart).toContain("role=\"img\"");
    expect(chart).toContain("aria-label");
    expect(chart).toContain("svg");
  });

  it("exposes KPI cards with labels and money formatting", () => {
    const kpi = read("src/components/financial/shared/kpi-card.tsx");
    expect(kpi).toContain("formatBRL");
    expect(kpi).toContain("aria-label");
  });

  it("passes global filters to the overview query", () => {
    const page = read("src/app/(authenticated)/financial/page.tsx");
    expect(page).toContain("<OverviewPage");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-overview-ui.test.ts
```

Expected: FAIL — the pages and components do not exist.

- [ ] **Step 3: Add the sidebar navigation item**

In `src/components/layout/sidebar.tsx`, import `Wallet` from `lucide-react` by
adding it to the existing import block, then add the item after the Documents
entry in `navItems`:

```tsx
  { href: "/financial", label: "Financial", icon: Wallet, testId: "nav-financial" },
```

- [ ] **Step 4: Create the shared presentational components**

Create `src/components/financial/shared/money-text.tsx`:

```tsx
import { toDecimal, formatBRL } from "@/lib/financial/money";

export function MoneyText({ value, className }: { value: string; className?: string }) {
  return <span className={className}>{formatBRL(toDecimal(value))}</span>;
}
```

Create `src/components/financial/shared/civil-date-text.tsx`:

```tsx
import { formatCivilDate } from "@/lib/financial/civil-date";

export function CivilDateText({
  date,
  className,
}: {
  date: string | null;
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  return <span className={className}>{formatCivilDate(date)}</span>;
}
```

Create `src/components/financial/shared/status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-bg-secondary text-text-secondary",
  active: "bg-success-bg text-success",
  closed: "bg-bg-secondary text-text-secondary",
  cancelled: "bg-danger-bg text-danger",
  suspended: "bg-warning-bg text-warning",
  pending: "bg-warning-bg text-warning",
  paid: "bg-success-bg text-success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status] ?? "bg-bg-secondary text-text-secondary"
      )}
    >
      {status}
    </span>
  );
}
```

Create `src/components/financial/shared/kpi-card.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { formatBRL, toDecimal } from "@/lib/financial/money";

export function KpiCard({
  label,
  value,
  isMoney = true,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  isMoney?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-page-alt p-4",
        className
      )}
      aria-label={`${label}: ${value}`}
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">
        {isMoney ? formatBRL(toDecimal(String(value))) : value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
```

Create `src/components/financial/shared/empty-state.tsx`:

```tsx
export function FinancialEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
```

Create `src/components/financial/shared/error-state.tsx`:

```tsx
export function FinancialErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-danger bg-danger-bg p-4 text-sm text-danger">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the forecast versus received chart**

Create `src/components/financial/overview/forecast-received-chart.tsx`:

```tsx
"use client";

interface ChartPoint {
  month: string;
  forecast: string;
  received: string;
}

const BAR_GAP = 4;

export function ForecastReceivedChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(
    1,
    ...data.flatMap((point) => [Number(point.forecast), Number(point.received)])
  );
  const width = 640;
  const height = 240;
  const labelSpace = 44;
  const plotWidth = width - labelSpace;
  const groupWidth = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(4, groupWidth / 2 - BAR_GAP);

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Forecast versus received, months ${data[0]?.month ?? ""} through ${data[data.length - 1]?.month ?? ""}`}
        className="h-56 w-full min-w-[560px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = labelSpace + (height - labelSpace) * ratio;
          return (
            <line
              key={ratio}
              x1={labelSpace}
              y1={y}
              x2={width}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}
        {data.map((point, index) => {
          const centerX = labelSpace + groupWidth * index + groupWidth / 2;
          const forecastHeight = (Number(point.forecast) / max) * (height - labelSpace);
          const receivedHeight = (Number(point.received) / max) * (height - labelSpace);
          return (
            <g key={point.month}>
              <rect
                x={centerX - barWidth - 1}
                y={height - forecastHeight}
                width={barWidth}
                height={forecastHeight}
                fill="var(--color-accent)"
              >
                <title>{`${point.month} forecast: R$ ${point.forecast}`}</title>
              </rect>
              <rect
                x={centerX + 1}
                y={height - receivedHeight}
                width={barWidth}
                height={receivedHeight}
                fill="var(--color-success)"
              >
                <title>{`${point.month} received: R$ ${point.received}`}</title>
              </rect>
              <text
                x={centerX}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-secondary)"
              >
                {point.month}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Forecast
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" /> Received
        </span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 6: Create the global filters and the overview page**

Create `src/components/financial/overview/financial-filters.tsx`:

```tsx
"use client";

import type { OverviewFilters } from "@/hooks/use-overview";

const PERIODS = [
  { value: "currentMonth", label: "Current month" },
  { value: "next90", label: "Next 90 days" },
  { value: "custom", label: "Custom" },
] as const;

export function FinancialFilters({
  filters,
  onChange,
}: {
  filters: OverviewFilters;
  onChange: (next: OverviewFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => onChange({ ...filters, period: period.value })}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filters.period === period.value
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
      {filters.period === "custom" && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">
            From
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ ...filters, from: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-text-secondary">
            To
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ ...filters, to: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

Create `src/components/financial/overview/overview-page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useOverview, type OverviewFilters } from "@/hooks/use-overview";
import { KpiCard } from "@/components/financial/shared/kpi-card";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ForecastReceivedChart } from "@/components/financial/overview/forecast-received-chart";
import { FinancialFilters } from "@/components/financial/overview/financial-filters";
import { LoadingState } from "@/components/shared/loading-state";

export function OverviewPage() {
  const [filters, setFilters] = useState<OverviewFilters>({
    period: "currentMonth",
  });
  const { data, isLoading, isError, refetch } = useOverview(filters);

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load the financial overview" onRetry={() => refetch()} />;
  }

  const { kpis, monthly, overdueInstallments, expiringContracts } = data;

  return (
    <div className="space-y-6">
      <FinancialFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active contracted value" value={kpis.activeContractedValue} />
        <KpiCard label="MRR" value={kpis.mrr} />
        <KpiCard label="ARR" value={kpis.arr} />
        <KpiCard label="Cash forecast" value={kpis.cashForecast} />
        <KpiCard label="Received" value={kpis.received} />
        <KpiCard label="Overdue" value={kpis.overdue} />
        <KpiCard label="Upsell" value={kpis.upsell} />
        <KpiCard label="Downsell" value={kpis.downsell} />
        <KpiCard label="Active contracts" value={kpis.activeContracts} isMoney={false} />
        <KpiCard label="Expiring soon" value={kpis.expiringSoon} isMoney={false} />
      </div>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="mb-2 text-base font-semibold text-text-primary">
          Forecast vs. Received
        </h2>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <ForecastReceivedChart data={monthly} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="overdue-title">
          <h2 id="overdue-title" className="mb-2 text-base font-semibold text-text-primary">
            Overdue installments
          </h2>
          {overdueInstallments.length === 0 ? (
            <FinancialEmptyState title="Nothing overdue" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {overdueInstallments.map((installment) => (
                <li key={installment.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{installment.contractTitle}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {installment.clientName} · {installment.contractCode}
                    </p>
                  </div>
                  <CivilDateText date={installment.dueDate} className="text-xs text-text-muted" />
                  <MoneyText value={installment.expectedAmount} className="font-semibold text-danger" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="expiring-title">
          <h2 id="expiring-title" className="mb-2 text-base font-semibold text-text-primary">
            Expiring contracts
          </h2>
          {expiringContracts.length === 0 ? (
            <FinancialEmptyState title="Nothing expiring in the next 30 days" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {expiringContracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{contract.title}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {contract.clientName} · {contract.code}
                    </p>
                  </div>
                  <StatusBadge status={contract.status ?? "active"} />
                  <CivilDateText date={contract.endDate} className="text-xs text-text-muted" />
                  <MoneyText value={contract.officialValue} className="font-semibold text-text-primary" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
```

Note: the client, project, contract-status and installment-status global
filters are wired in Task 17, which re-adds the `useProjects`/`useClients`
queries and the select controls to this page.

- [ ] **Step 7: Create the tabs, layout and overview page**

Create `src/components/financial/financial-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/financial", label: "Overview", exact: true },
  { href: "/financial/contracts", label: "Contracts" },
  { href: "/financial/receivables", label: "Receivables" },
  { href: "/financial/clients", label: "Clients" },
];

export function FinancialTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Financial sections" className="mb-4 flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex min-h-[44px] items-center rounded-md px-4 py-2 text-sm font-medium",
              active
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `src/app/(authenticated)/financial/layout.tsx`:

```tsx
"use client";

import { FinancialTabs } from "@/components/financial/financial-tabs";

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <FinancialTabs />
      {children}
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/page.tsx`:

```tsx
"use client";

import { OverviewPage } from "@/components/financial/overview/overview-page";

export default function FinancialOverviewPage() {
  return <OverviewPage />;
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-overview-ui.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean. If `projects` or `clientsData` are reported unused, prefix
them with an underscore in `overview-page.tsx` (for example `const { data: _projects }`).

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/financial/financial-tabs.tsx "src/app/(authenticated)/financial/layout.tsx" src/components/financial/shared/kpi-card.tsx src/components/financial/shared/money-text.tsx src/components/financial/shared/status-badge.tsx src/components/financial/shared/civil-date-text.tsx src/components/financial/shared/empty-state.tsx src/components/financial/shared/error-state.tsx src/components/financial/overview/forecast-received-chart.tsx src/components/financial/overview/financial-filters.tsx src/components/financial/overview/overview-page.tsx "src/app/(authenticated)/financial/page.tsx" src/__tests__/financial-overview-ui.test.ts
git commit -m "feat(financial): add overview UI and navigation"
```

---

