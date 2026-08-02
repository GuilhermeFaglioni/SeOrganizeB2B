# Financial Module — Task 15

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 15: Add Receivables UI

**Files:**
- Create: `src/components/financial/receivables/receivables-list.tsx`
- Create: `src/components/financial/receivables/installment-actions.tsx`
- Create: `src/app/(authenticated)/financial/receivables/page.tsx`
- Create: `src/__tests__/financial-receivables-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-receivables-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("receivables UI", () => {
  it("keeps the receivables route present", () => {
    expect(exists("src/app/(authenticated)/financial/receivables/page.tsx")).toBe(true);
  });

  it("lists installments with status filters and CSV export", () => {
    const list = read("src/components/financial/receivables/receivables-list.tsx");
    expect(list).toContain("pending");
    expect(list).toContain("paid");
    expect(list).toContain("overdue");
    expect(list).toContain("cancelled");
    expect(list).toContain("exportReceivablesCsv");
  });

  it("supports paying, cancelling and refunding installments", () => {
    const actions = read("src/components/financial/receivables/installment-actions.tsx");
    expect(actions).toContain("useMarkInstallmentPaid");
    expect(actions).toContain("useCancelInstallment");
    expect(actions).toContain("useRefundInstallment");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-receivables-ui.test.ts
```

Expected: FAIL — the components and page do not exist.

- [ ] **Step 3: Create the installment actions component**

Create `src/components/financial/receivables/installment-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  useCancelInstallment,
  useMarkInstallmentPaid,
  useRefundInstallment,
} from "@/hooks/use-installments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InstallmentActions({
  installment,
}: {
  installment: {
    id: string;
    status: string;
    expectedAmount: string;
    dueDate: string;
  };
}) {
  const markPaid = useMarkInstallmentPaid();
  const cancel = useCancelInstallment();
  const refund = useRefundInstallment();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState("");

  if (installment.status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            markPaid.mutate({
              id: installment.id,
              paidAt: new Date().toISOString().slice(0, 10),
            })
          }
        >
          Mark paid
        </Button>
        <Button size="sm" variant="outline" onClick={() => cancel.mutate(installment.id)}>
          Cancel
        </Button>
      </div>
    );
  }

  if (installment.status === "paid") {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
          Refund
        </Button>
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record refund</DialogTitle>
              <DialogDescription>
                The refund creates a negative paid installment linked to the
                original one and subtracts from received revenue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm text-text-secondary">
                Refund amount (BRL)
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-text-secondary">
                Refund date
                <input
                  type="date"
                  value={refundDate}
                  onChange={(event) => setRefundDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>
                Close
              </Button>
              <Button
                disabled={!refundAmount || !refundDate}
                onClick={() =>
                  refund.mutate(
                    {
                      id: installment.id,
                      refundAmount,
                      refundDate,
                    },
                    { onSuccess: () => setRefundOpen(false) }
                  )
                }
              >
                Confirm refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
```

- [ ] **Step 4: Create the receivables list and page**

Create `src/components/financial/receivables/receivables-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";
import { exportReceivablesCsv } from "@/hooks/use-financial-exports";
import { useProjects } from "@/hooks/use-projects";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { InstallmentActions } from "@/components/financial/receivables/installment-actions";
import { LoadingState } from "@/components/shared/loading-state";
import type { Paginated } from "@/lib/financial/types";

interface ReceivableRow {
  id: string;
  expectedAmount: string;
  dueDate: string;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  refundOfId: string | null;
  contract: {
    id: string;
    code: string;
    title: string;
    client: { name: string };
  };
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export function ReceivablesList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<Paginated<ReceivableRow>>({
    queryKey: ["receivables", { status, page, projectId }],
    queryFn: () =>
      fetchJson<Paginated<ReceivableRow>>(
        `/api/receivables${qs({ status, page, pageSize, projectId })}`
      ),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load receivables" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  status === tab.value
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {projects && projects.length > 0 && (
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <CsvExportButton
          label="Export CSV"
          onExport={() => exportReceivablesCsv({ status, projectId })}
        />
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No installments match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Receivables</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Contract</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                <th scope="col" className="px-3 py-2 font-medium">Due date</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((installment) => (
                <tr key={installment.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${installment.contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {installment.contract.title}
                    </Link>
                    <p className="font-mono text-xs text-text-muted">{installment.contract.code}</p>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{installment.contract.client.name}</td>
                  <td className="px-3 py-2 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-2"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-2">
                    <InstallmentActions installment={installment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

Note: this list reads `/api/receivables`, which does not exist yet. Add it now
as a thin GET adapter in the same task:

Create `src/app/api/receivables/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { todayCivilDate } from "@/lib/financial/civil-date";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "";
  const projectId = searchParams.get("projectId") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );

  const today = todayCivilDate();
  const where = {
    ...(projectId ? { contract: { projects: { some: { projectId } } } } : {}),
    ...(status === "overdue"
      ? { status: "pending", dueDate: { lt: today } }
      : status
        ? { status }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.installment.findMany({
      where,
      include: {
        contract: {
          include: { client: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.installment.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    error: null,
  });
}
```

Create `src/app/(authenticated)/financial/receivables/page.tsx`:

```tsx
"use client";

import { ReceivablesList } from "@/components/financial/receivables/receivables-list";

export default function FinancialReceivablesPage() {
  return <ReceivablesList />;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-receivables-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/financial/receivables/receivables-list.tsx src/components/financial/receivables/installment-actions.tsx src/app/api/receivables/route.ts "src/app/(authenticated)/financial/receivables/page.tsx" src/__tests__/financial-receivables-ui.test.ts
git commit -m "feat(financial): add receivables UI"
```

---

