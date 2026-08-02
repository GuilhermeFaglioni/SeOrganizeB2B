# Financial Module — Task 14

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 14: Add Contracts UI

**Files:**
- Create: `src/components/financial/contracts/contract-list.tsx`
- Create: `src/components/financial/contracts/contract-search-filters.tsx`
- Create: `src/components/financial/contracts/pagination.tsx`
- Create: `src/components/financial/contracts/csv-export-button.tsx`
- Create: `src/components/financial/contracts/contract-form.tsx`
- Create: `src/components/financial/contracts/contract-detail.tsx`
- Create: `src/components/financial/contracts/lifecycle-actions.tsx`
- Create: `src/components/financial/contracts/change-dialog.tsx`
- Create: `src/app/(authenticated)/financial/contracts/page.tsx`
- Create: `src/app/(authenticated)/financial/contracts/new/page.tsx`
- Create: `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`
- Create: `src/__tests__/financial-contracts-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-contracts-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("contracts UI", () => {
  it("keeps the list, new and detail routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/contracts/page.tsx",
      "src/app/(authenticated)/financial/contracts/new/page.tsx",
      "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders one scrollable form with collapsible sections", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Contract data");
    expect(form).toContain("Scope and items");
    expect(form).toContain("Linked projects");
    expect(form).toContain("Billing and installments");
    expect(form).toContain("toggleSection");
  });

  it("shows a financial consistency summary before activation", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain("Installment total");
    expect(form).toContain("Official value");
    expect(form).toContain("useContractLifecycle");
    expect(form).toContain('action: "activate"');
  });

  it("defaults a missing item quantity to 1 in the item-price sum", () => {
    const form = read("src/components/financial/contracts/contract-form.tsx");
    expect(form).toContain('.times(toDecimal(item.quantity ?? "1"))');
    expect(form).toContain("toDecimal(0)");
    expect(form).not.toContain("String(Number(");
    expect(form).not.toContain(".times(toDecimal(item.quantity ?? \"0\"))");
  });

  it("exposes lifecycle actions including renew and cancel", () => {
    const actions = read("src/components/financial/contracts/lifecycle-actions.tsx");
    expect(actions).toContain("activate");
    expect(actions).toContain("suspend");
    expect(actions).toContain("resume");
    expect(actions).toContain("close");
    expect(actions).toContain("cancel");
    expect(actions).toContain("renew");
  });

  it("lists contracts with server-side filters and CSV export", () => {
    const list = read("src/components/financial/contracts/contract-list.tsx");
    expect(list).toContain("useContracts");
    expect(list).toContain("exportContractsCsv");
  });

  it("shows a two-step confirmation for upsell and downsell", () => {
    const dialog = read("src/components/financial/contracts/change-dialog.tsx");
    expect(dialog).toContain("proposal");
    expect(dialog).toContain("confirm");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-contracts-ui.test.ts
```

Expected: FAIL — the components and pages do not exist.

- [ ] **Step 3: Create the pagination and CSV button primitives**

Create `src/components/financial/contracts/pagination.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 py-3 text-sm text-text-secondary">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm disabled:opacity-40"
        aria-label="Next page"
      >
        Next <ChevronRight size={16} />
      </button>
    </nav>
  );
}
```

Create `src/components/financial/contracts/csv-export-button.tsx`:

```tsx
"use client";

import { Download } from "lucide-react";

export function CsvExportButton({
  onExport,
  label = "Export CSV",
}: {
  onExport: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onExport}
      className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-page-alt px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
    >
      <Download size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Create the list filters, list and list page**

Create `src/components/financial/contracts/contract-search-filters.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export interface ContractFiltersValue {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
}

export function ContractSearchFilters({
  values,
  onChange,
  clients,
  projects,
}: {
  values: ContractFiltersValue;
  onChange: (next: ContractFiltersValue) => void;
  clients?: Array<{ id: string; name: string }>;
  projects?: Array<{ id: string; name: string }>;
}) {
  const [query, setQuery] = useState(values.search ?? "");
  const statuses = ["draft", "active", "closed", "cancelled", "suspended"];

  function submitSearch() {
    onChange({ ...values, search: query.trim() || undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="contract-search" className="sr-only">
          Search contracts
        </label>
        <input
          id="contract-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitSearch();
          }}
          placeholder="Search by title, code or client"
          className="w-56 rounded-md border border-border bg-page-alt px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submitSearch}
          className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          aria-label="Search contracts"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>

      <label className="text-sm text-text-secondary">
        Status
        <select
          value={values.status ?? ""}
          onChange={(event) =>
            onChange({ ...values, status: event.target.value || undefined })
          }
          className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      {clients && clients.length > 0 && (
        <label className="text-sm text-text-secondary">
          Client
          <select
            value={values.clientId ?? ""}
            onChange={(event) =>
              onChange({ ...values, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {projects && projects.length > 0 && (
        <label className="text-sm text-text-secondary">
          Project
          <select
            value={values.projectId ?? ""}
            onChange={(event) =>
              onChange({ ...values, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
```

Create `src/components/financial/contracts/contract-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useContracts, type ContractListFilters } from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { exportContractsCsv } from "@/hooks/use-financial-exports";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ContractSearchFilters } from "@/components/financial/contracts/contract-search-filters";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractList() {
  const [filters, setFilters] = useState<ContractListFilters>({
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const { data, isLoading, isError, refetch } = useContracts(filters);
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load contracts" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContractSearchFilters
          values={filters}
          onChange={(next) => setFilters({ ...filters, ...next, page: 1 })}
          clients={clientsData?.items}
          projects={projects}
        />
        <div className="flex items-center gap-2">
          <CsvExportButton onExport={() => exportContractsCsv(filters)} />
          <Link
            href="/financial/contracts/new"
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} aria-hidden="true" /> New contract
          </Link>
        </div>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No contracts match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Contracts</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Code</th>
                <th scope="col" className="px-3 py-2 font-medium">Title</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Official value</th>
                <th scope="col" className="px-3 py-2 font-medium">Start</th>
                <th scope="col" className="px-3 py-2 font-medium">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((contract) => (
                <tr key={contract.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{contract.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{contract.client.name}</td>
                  <td className="px-3 py-2"><StatusBadge status={contract.status} /></td>
                  <td className="px-3 py-2 font-medium"><MoneyText value={contract.officialValue} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.startDate} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.endDate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/contracts/page.tsx`:

```tsx
"use client";

import { ContractList } from "@/components/financial/contracts/contract-list";

export default function FinancialContractsPage() {
  return <ContractList />;
}
```

- [ ] **Step 5: Create the contract form**

Create `src/components/financial/contracts/contract-form.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useCreateContract,
  useUpdateContract,
  useContract,
  useContractLifecycle,
} from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { useProfiles } from "@/hooks/use-profiles";
import { suggestPlan, sumPlan, validateFinitePlan } from "@/lib/financial/installments";
import { toDecimal, eq, formatBRL } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { ContractDetail } from "@/hooks/use-contracts";

const DURATION_TYPES = [
  { value: "fixed", label: "Fixed term" },
  { value: "openEnded", label: "Open-ended recurring" },
  { value: "oneTime", label: "One-time" },
];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "annual", label: "Annual" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

interface ItemRow {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  position: number;
}

export function ContractForm({ contractId }: { contractId?: string }) {
  const router = useRouter();
  const { data: existing } = useContract(contractId ?? "");
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();
  const { data: profiles } = useProfiles();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [clientId, setClientId] = useState(existing?.clientId ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? "");
  const [durationType, setDurationType] = useState(existing?.durationType ?? "fixed");
  const [officialValue, setOfficialValue] = useState(existing?.officialValue ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? "");
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [billingFrequency, setBillingFrequency] = useState(existing?.billingFrequency ?? "monthly");
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod ?? "pix");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    contract: true,
    scope: true,
    projects: true,
    billing: true,
  });

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const lifecycle = useContractLifecycle();

  const itemSum = useMemo(
    () =>
      items.reduce(
        (acc, item) =>
          acc.plus(
            toDecimal(item.price ?? "0").times(toDecimal(item.quantity ?? "1"))
          ),
        toDecimal(0)
      ),
    [items]
  );

  const suggestedPlan = useMemo(() => {
    if (!officialValue || !startDate) return [];
    try {
      return suggestPlan(
        toDecimal(officialValue),
        durationType as "fixed" | "openEnded" | "oneTime",
        startDate,
        endDate || null,
        (billingFrequency as "monthly" | "quarterly" | "semiannual" | "annual") || null,
        paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [officialValue, startDate, endDate, durationType, billingFrequency, paymentMethod]);

  const planTotal = useMemo(() => sumPlan(suggestedPlan), [suggestedPlan]);
  const planErrors =
    durationType === "openEnded"
      ? !eq(planTotal, toDecimal(officialValue))
        ? ["Installment total must equal the official contract value"]
        : []
      : validateFinitePlan(suggestedPlan, toDecimal(officialValue || "0"));
  const itemMismatch = items.length > 0 && !eq(itemSum, toDecimal(officialValue || "0"));

  function payload(extra: Record<string, unknown> = {}) {
    return {
      title,
      clientId,
      ownerId: ownerId || undefined,
      durationType,
      officialValue,
      startDate,
      endDate: endDate || null,
      billingFrequency,
      paymentMethod,
      notes: notes || null,
      items: items
        .filter((item) => item.name.trim())
        .map((item) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity || null,
          unit: item.unit || null,
          price: item.price || null,
          position: item.position,
        })),
      projectIds,
      ...extra,
    };
  }

  function saveDraft() {
    if (contractId) {
      updateContract.mutate({ id: contractId, ...payload() });
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          router.push(`/financial/contracts/${(contract as { id: string }).id}`);
        },
      });
    }
  }

  function activate() {
    const navigate = (id: string) => {
      lifecycle.mutate(
        { id, action: "activate", plan: suggestedPlan },
        {
          onSuccess: () => {
            toastSuccess("Contract activated");
            router.push(`/financial/contracts/${id}`);
          },
        }
      );
    };
    if (contractId) {
      navigate(contractId);
    } else {
      createContract.mutate(payload(), {
        onSuccess: (contract) => {
          toastSuccess("Draft saved");
          navigate((contract as { id: string }).id);
        },
      });
    }
  }

  function toggleSection(key: string) {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("contract")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Contract data</h2>
          {sectionsOpen.contract ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.contract && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contract-title">Title</Label>
              <Input id="contract-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-client">Client</Label>
              <select
                id="contract-client"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">Select client</option>
                {clientsData?.items.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-owner">Internal owner</Label>
              <select
                id="contract-owner"
                value={ownerId ?? ""}
                onChange={(event) => setOwnerId(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {profiles?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name || profile.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-duration">Duration type</Label>
              <select
                id="contract-duration"
                value={durationType}
                onChange={(event) => setDurationType(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {DURATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-value">Official value (BRL)</Label>
              <Input
                id="contract-value"
                type="number"
                step="0.01"
                min="0"
                value={officialValue}
                onChange={(event) => setOfficialValue(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-start">Start date</Label>
              <Input id="contract-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="contract-end">End date</Label>
              <Input
                id="contract-end"
                type="date"
                value={endDate}
                disabled={durationType === "openEnded" || durationType === "oneTime"}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contract-frequency">Billing frequency</Label>
              <select
                id="contract-frequency"
                value={billingFrequency ?? "monthly"}
                disabled={durationType === "oneTime"}
                onChange={(event) => setBillingFrequency(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="contract-payment">Payment method</Label>
              <select
                id="contract-payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contract-notes">Notes</Label>
              <textarea
                id="contract-notes"
                value={notes ?? ""}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("scope")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Scope and items</h2>
          {sectionsOpen.scope ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.scope && (
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <input
                  aria-label={`Item name ${index + 1}`}
                  value={item.name}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                  }
                  placeholder="Item name"
                  className="col-span-2 rounded-md border border-border bg-page px-3 py-2 text-sm sm:col-span-2"
                />
                <input
                  aria-label={`Item price ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.price ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, price: event.target.value } : row)))
                  }
                  placeholder="Price"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <input
                  aria-label={`Item quantity ${index + 1}`}
                  type="number"
                  step="0.01"
                  value={item.quantity ?? ""}
                  onChange={(event) =>
                    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))
                  }
                  placeholder="Qty"
                  className="rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  className="flex min-h-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { name: "", position: prev.length },
                ])
              }
              className="flex min-h-[44px] items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
            >
              <Plus size={16} /> Add item
            </button>
            {itemMismatch && (
              <p className="rounded-md bg-warning-bg p-3 text-sm text-warning">
                The item-price sum ({formatBRL(itemSum)}) does not match the
                official contract value ({formatBRL(toDecimal(officialValue || "0"))}).
                This warning does not block saving.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("projects")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Linked projects</h2>
          {sectionsOpen.projects ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.projects && (
          <div className="mt-4 space-y-2">
            {projects?.map((project) => (
              <label key={project.id} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={(event) =>
                    setProjectIds((prev) =>
                      event.target.checked
                        ? [...prev, project.id]
                        : prev.filter((id) => id !== project.id)
                    )
                  }
                  className="h-4 w-4"
                />
                {project.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <button type="button" onClick={() => toggleSection("billing")} className="flex w-full items-center justify-between text-left">
          <h2 className="text-base font-semibold text-text-primary">Billing and installments</h2>
          {sectionsOpen.billing ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {sectionsOpen.billing && (
          <div className="mt-4 space-y-3">
            {suggestedPlan.length === 0 ? (
              <p className="text-sm text-text-muted">
                Fill in the value and dates to preview the suggested installment schedule.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs uppercase text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                      <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                      <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suggestedPlan.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-1">{item.dueDate}</td>
                        <td className="px-3 py-1 font-medium">{formatBRL(toDecimal(item.expectedAmount))}</td>
                        <td className="px-3 py-1">{item.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-text-secondary">
              Installment total: {formatBRL(planTotal)} · Official value:{" "}
              {formatBRL(toDecimal(officialValue || "0"))}
            </p>
            {planErrors.map((error) => (
              <p key={error} role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">
                {error}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={saveDraft}>
          Save draft
        </Button>
        {(!existing || existing.status === "draft") && (
          <Button
            onClick={activate}
            disabled={suggestedPlan.length === 0 || planErrors.length > 0}
          >
            Activate
          </Button>
        )}
      </div>
    </div>
  );
}
```

The activation flow is now real: clicking **Activate** saves the draft through
`POST /api/contracts` when no contract exists yet (or patches the existing
draft) and then runs the transactional `activateContract` through
`POST /api/contracts/[id]/lifecycle` with the server-consistent
`suggestedPlan`. The button is disabled until a consistent installment plan
exists, mirroring the activation validation on the server.

Create `src/app/(authenticated)/financial/contracts/new/page.tsx`:

```tsx
"use client";

import { ContractForm } from "@/components/financial/contracts/contract-form";

export default function NewContractPage() {
  return <ContractForm />;
}
```

- [ ] **Step 6: Create the detail, lifecycle actions and change dialog**

Create `src/components/financial/contracts/lifecycle-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractLifecycle } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import type { InstallmentPlanItem } from "@/lib/financial/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LifecycleActions({
  contractId,
  status,
  plan,
}: {
  contractId: string;
  status: string;
  plan?: InstallmentPlanItem[];
}) {
  const router = useRouter();
  const lifecycle = useContractLifecycle();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");

  function run(action: string, extra: Record<string, unknown> = {}) {
    lifecycle.mutate(
      { id: contractId, action, ...extra },
      {
        onSuccess: () => {
          toastSuccess(`Contract ${action.replace("_", " ")}`);
          router.refresh();
        },
      }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <Button
          onClick={() => run("activate", { plan })}
          disabled={!plan || plan.length === 0}
        >
          Activate
        </Button>
      )}
      {status === "active" && (
        <Button variant="outline" onClick={() => run("suspend")}>
          Suspend
        </Button>
      )}
      {status === "suspended" && (
        <Button variant="outline" onClick={() => run("resume")}>
          Resume
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("close")}>
          Close
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("renew")}>
          Renew
        </Button>
      )}
      {(status === "active" || status === "suspended" || status === "draft") && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancel
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel contract</DialogTitle>
            <DialogDescription>
              Future installments after the effective date will be cancelled.
              Paid and already overdue installments remain collectible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="cancel-date" className="text-sm text-text-secondary">
              Effective date
            </label>
            <input
              id="cancel-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep contract
            </Button>
            <Button
              variant="destructive"
              disabled={!effectiveDate}
              onClick={() => {
                run("cancel", { effectiveDate, retainedInstallmentIds: [] });
                setCancelOpen(false);
              }}
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Create `src/components/financial/contracts/change-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useContractChange } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChangeDialog({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useContractChange();
  const [type, setType] = useState<"upsell" | "downsell">("upsell");
  const [delta, setDelta] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [strategy, setStrategy] = useState<"redistribute" | "adjust">("redistribute");
  const [proposal, setProposal] = useState<unknown>(null);

  function requestProposal(confirm = false) {
    change.mutate(
      {
        id: contractId,
        type,
        delta,
        effectiveDate,
        description: description || undefined,
        strategy,
        confirm,
      },
      {
        onSuccess: (result) => {
          const data = result as { applied: boolean; proposal?: unknown };
          if (!data.applied) {
            setProposal(data.proposal ?? null);
          } else {
            toastSuccess("Contract value updated");
            setProposal(null);
            onOpenChange(false);
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust contract value</DialogTitle>
          <DialogDescription>
            Review the proposed change before applying it. Paid installments
            are never modified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "upsell" | "downsell")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm"
              >
                <option value="upsell">Upsell</option>
                <option value="downsell">Downsell</option>
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              Strategy
              <select
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as "redistribute" | "adjust")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm"
              >
                <option value="redistribute">Redistribute across pending</option>
                <option value="adjust">Additional / negative installment</option>
              </select>
            </label>
          </div>
          <label className="block text-sm text-text-secondary">
            Delta (BRL)
            <input
              type="number"
              step="0.01"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Effective date
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </label>
          {proposal && (
            <div className="rounded-md bg-bg-secondary p-3 text-sm text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">Proposed result</p>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(proposal, null, 2)}</pre>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!proposal && (
            <Button
              disabled={!delta || !effectiveDate}
              onClick={() => requestProposal(false)}
            >
              Preview proposal
            </Button>
          )}
          {proposal && (
            <Button onClick={() => requestProposal(true)}>Confirm and apply</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Create `src/components/financial/contracts/contract-detail.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useContract } from "@/hooks/use-contracts";
import { useMarkInstallmentPaid } from "@/hooks/use-installments";
import { suggestPlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { LifecycleActions } from "@/components/financial/contracts/lifecycle-actions";
import { ChangeDialog } from "@/components/financial/contracts/change-dialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractDetail({ contractId }: { contractId: string }) {
  const { data: contract, isLoading, isError, refetch } = useContract(contractId);
  const markPaid = useMarkInstallmentPaid();
  const [changeOpen, setChangeOpen] = useState(false);

  const activationPlan = useMemo(() => {
    if (!contract) return [];
    try {
      return suggestPlan(
        toDecimal(contract.officialValue),
        contract.durationType,
        contract.startDate,
        contract.endDate,
        contract.billingFrequency,
        contract.paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [contract]);

  if (isLoading) return <LoadingState />;
  if (isError || !contract) {
    return <FinancialErrorState message="Failed to load the contract" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">{contract.code}</p>
          <h1 className="text-xl font-semibold text-text-primary">{contract.title}</h1>
          <p className="text-sm text-text-secondary">{contract.client.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={contract.status} />
          <div className="flex flex-wrap gap-2">
            <LifecycleActions
              contractId={contract.id}
              status={contract.status}
              plan={activationPlan}
            />
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => setChangeOpen(true)}>
                Adjust value
              </Button>
            )}
          </div>
        </div>
      </div>

      <section aria-labelledby="commercial-summary" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="commercial-summary" className="mb-3 text-base font-semibold text-text-primary">
          Commercial summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Official value</dt>
            <dd className="font-semibold text-text-primary"><MoneyText value={contract.officialValue} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Duration</dt>
            <dd className="text-text-primary">{contract.durationType}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Start</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.startDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">End</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.endDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Billing frequency</dt>
            <dd className="text-text-primary">{contract.billingFrequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Payment method</dt>
            <dd className="text-text-primary">{contract.paymentMethod}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="items-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="items-title" className="mb-3 text-base font-semibold text-text-primary">Items</h2>
        {contract.items.length === 0 ? (
          <p className="text-sm text-text-muted">No items recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Name</th>
                  <th scope="col" className="px-3 py-1 font-medium">Quantity</th>
                  <th scope="col" className="px-3 py-1 font-medium">Unit</th>
                  <th scope="col" className="px-3 py-1 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1 font-medium">{item.name}</td>
                    <td className="px-3 py-1">{item.quantity ?? "—"}</td>
                    <td className="px-3 py-1">{item.unit ?? "—"}</td>
                    <td className="px-3 py-1">{item.price ? <MoneyText value={item.price} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="projects-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="projects-title" className="mb-3 text-base font-semibold text-text-primary">Linked projects</h2>
        {contract.projects.length === 0 ? (
          <p className="text-sm text-text-muted">No linked projects.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {contract.projects.map((link) => (
              <li key={link.project.id} className="rounded-md bg-bg-secondary px-3 py-1 text-sm text-text-secondary">
                {link.project.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="installments-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="installments-title" className="mb-3 text-base font-semibold text-text-primary">Installments</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                <th scope="col" className="px-3 py-1 font-medium">Status</th>
                <th scope="col" className="px-3 py-1 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                <th scope="col" className="px-3 py-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contract.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-1"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-1 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-1"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-1"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-1">{installment.paymentMethod}</td>
                  <td className="px-3 py-1">
                    {installment.status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          markPaid.mutate({
                            id: installment.id,
                            paidAt: new Date().toISOString().slice(0, 10),
                          })
                        }
                        className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {contract.changes.length > 0 && (
        <section aria-labelledby="changes-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="changes-title" className="mb-3 text-base font-semibold text-text-primary">Upsell and downsell history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Type</th>
                  <th scope="col" className="px-3 py-1 font-medium">Delta</th>
                  <th scope="col" className="px-3 py-1 font-medium">Effective</th>
                  <th scope="col" className="px-3 py-1 font-medium">Previous</th>
                  <th scope="col" className="px-3 py-1 font-medium">New</th>
                  <th scope="col" className="px-3 py-1 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.changes.map((change) => (
                  <tr key={change.id}>
                    <td className="px-3 py-1 capitalize">{change.type}</td>
                    <td className="px-3 py-1 font-medium"><MoneyText value={change.delta} /></td>
                    <td className="px-3 py-1"><CivilDateText date={change.effectiveDate} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.previousValue} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.newValue} /></td>
                    <td className="px-3 py-1 text-text-secondary">{change.reason ?? change.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {contract.audits.length > 0 && (
        <section aria-labelledby="audit-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="audit-title" className="mb-3 text-base font-semibold text-text-primary">Audit history</h2>
          <ul className="divide-y divide-border text-sm">
            {contract.audits.map((audit) => (
              <li key={audit.id} className="py-2">
                <p className="text-text-primary">
                  <span className="font-medium">{audit.field}</span> changed
                  {audit.reason ? ` — ${audit.reason}` : ""}
                </p>
                <p className="text-xs text-text-muted">
                  {audit.actor?.name ?? "System"} · {new Date(audit.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChangeDialog contractId={contract.id} open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`:

```tsx
"use client";

import { ContractDetail } from "@/components/financial/contracts/contract-detail";

export default function ContractDetailPage({
  params,
}: {
  params: { contractId: string };
}) {
  return <ContractDetail contractId={params.contractId} />;
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-contracts-ui.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean. Fix any unused imports flagged by strict mode before
committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/financial/contracts/contract-list.tsx src/components/financial/contracts/contract-search-filters.tsx src/components/financial/contracts/pagination.tsx src/components/financial/contracts/csv-export-button.tsx src/components/financial/contracts/contract-form.tsx src/components/financial/contracts/contract-detail.tsx src/components/financial/contracts/lifecycle-actions.tsx src/components/financial/contracts/change-dialog.tsx "src/app/(authenticated)/financial/contracts/page.tsx" "src/app/(authenticated)/financial/contracts/new/page.tsx" "src/app/(authenticated)/financial/contracts/[contractId]/page.tsx" src/__tests__/financial-contracts-ui.test.ts
git commit -m "feat(financial): add contracts UI"
```

---

