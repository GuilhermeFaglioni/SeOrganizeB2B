# Financial Module — Task 12

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 12: Add React Query Hooks

**Files:**
- Create: `src/lib/financial/http.ts`
- Create: `src/hooks/use-clients.ts`
- Create: `src/hooks/use-contracts.ts`
- Create: `src/hooks/use-installments.ts`
- Create: `src/hooks/use-overview.ts`
- Create: `src/hooks/use-financial-exports.ts`
- Create: `src/__tests__/financial-hooks.test.ts`

- [ ] **Step 1: Write the failing hooks contract test**

Create `src/__tests__/financial-hooks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("financial hooks", () => {
  it("shares a query-string and fetchJson helper", () => {
    const source = read("src/lib/financial/http.ts");
    expect(source).toContain("export function qs");
    expect(source).toContain("export async function fetchJson");
    expect(source).toContain("json.error");
  });

  it("encodes server-side filters into query keys", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('queryKey: ["contracts", filters]');
    expect(source).toContain("search");
    expect(source).toContain("pageSize");
  });

  it("invalidates contracts and overview after mutations", () => {
    const source = read("src/hooks/use-contracts.ts");
    expect(source).toContain('invalidateQueries({ queryKey: ["contracts"');
    expect(source).toContain('invalidateQueries({ queryKey: ["overview"');
  });

  it("builds overview queries with global filters", () => {
    const source = read("src/hooks/use-overview.ts");
    expect(source).toContain('queryKey: ["overview", filters]');
    expect(source).toContain("period");
    expect(source).toContain("clientId");
  });

  it("downloads filtered CSV exports as blobs", () => {
    const source = read("src/hooks/use-financial-exports.ts");
    expect(source).toContain("blob()");
    expect(source).toContain("createObjectURL");
    expect(source).toContain('a.download');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-hooks.test.ts
```

Expected: FAIL — the helper and hook files do not exist.

- [ ] **Step 3: Create the shared HTTP helper**

Create `src/lib/financial/http.ts`:

```ts
export function qs(
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data as T;
}
```

- [ ] **Step 4: Create the clients hooks**

Create `src/hooks/use-clients.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type { Paginated } from "@/lib/financial/types";

export interface ClientData {
  id: string;
  name: string;
  legalName: string | null;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  _count?: { contracts: number };
}

export function useClients(filters: {
  search?: string;
  page?: number;
  pageSize?: number;
  active?: boolean;
}) {
  return useQuery<Paginated<ClientData>>({
    queryKey: ["clients", filters],
    queryFn: () => fetchJson<Paginated<ClientData>>(`/api/clients${qs(filters)}`),
  });
}

export function useClient(clientId: string) {
  return useQuery<ClientData & { contracts?: unknown[] }>({
    queryKey: ["clients", clientId],
    queryFn: () => fetchJson(`/api/clients/${clientId}`),
    enabled: Boolean(clientId),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }) =>
      fetchJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to create client"),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
      active?: boolean;
    }) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to update client"),
  });
}

export function useDeactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to deactivate client"),
  });
}
```

- [ ] **Step 5: Create the contracts hooks**

Create `src/hooks/use-contracts.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type {
  ContractSummary,
  InstallmentPlanItem,
  Paginated,
} from "@/lib/financial/types";

export interface ContractDetail extends ContractSummary {
  client: { id: string; name: string };
  owner: { id: string; name: string | null; email: string } | null;
  predecessor: { id: string; code: string; title: string; status: string } | null;
  successors: Array<{ id: string; code: string; title: string; status: string }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: string | null;
    unit: string | null;
    price: string | null;
    position: number;
  }>;
  projects: Array<{ project: { id: string; name: string } }>;
  installments: Array<{
    id: string;
    expectedAmount: string;
    dueDate: string;
    paymentMethod: string;
    status: string;
    paidAt: string | null;
    refundOfId: string | null;
  }>;
  changes: Array<{
    id: string;
    type: string;
    delta: string;
    effectiveDate: string;
    description: string | null;
    previousValue: string;
    newValue: string;
    reason: string | null;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    field: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string | null;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
}

export interface ContractListFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
}

export function useContracts(filters: ContractListFilters) {
  return useQuery<Paginated<ContractSummary>>({
    queryKey: ["contracts", filters],
    queryFn: () =>
      fetchJson<Paginated<ContractSummary>>(`/api/contracts${qs(filters)}`),
  });
}

export function useContract(contractId: string) {
  return useQuery<ContractDetail>({
    queryKey: ["contracts", contractId],
    queryFn: () => fetchJson<ContractDetail>(`/api/contracts/${contractId}`),
    enabled: Boolean(contractId),
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      clientId: string;
      ownerId?: string;
      durationType: string;
      officialValue: string;
      startDate: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod: string;
      documentUrl?: string | null;
      notes?: string | null;
      items?: Array<{
        name: string;
        description?: string | null;
        quantity?: string | null;
        unit?: string | null;
        price?: string | null;
        position: number;
      }>;
      projectIds?: string[];
    }) =>
      fetchJson("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to create contract"),
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      clientId?: string;
      ownerId?: string | null;
      durationType?: string;
      officialValue?: string;
      startDate?: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod?: string;
      documentUrl?: string | null;
      notes?: string | null;
    }) =>
      fetchJson(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to update contract"),
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to delete contract"),
  });
}

export function useContractLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      plan,
      effectiveDate,
      retainedInstallmentIds,
    }: {
      id: string;
      action: string;
      plan?: InstallmentPlanItem[];
      effectiveDate?: string;
      retainedInstallmentIds?: string[];
    }) =>
      fetchJson(`/api/contracts/${id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          plan,
          effectiveDate,
          retainedInstallmentIds,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Lifecycle action failed"),
  });
}

export function useContractChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      type: "upsell" | "downsell";
      delta: string;
      effectiveDate: string;
      description?: string;
      reason?: string;
      strategy: "redistribute" | "adjust";
      confirm?: boolean;
    }) =>
      fetchJson(`/api/contracts/${id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to apply contract change"),
  });
}
```

- [ ] **Step 6: Create the installments hooks**

Create `src/hooks/use-installments.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string }) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", paidAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to record payment"),
  });
}

export function useCancelInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to cancel installment"),
  });
}

export function useRefundInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      refundAmount,
      refundDate,
    }: {
      id: string;
      refundAmount: string;
      refundDate: string;
    }) =>
      fetchJson(`/api/installments/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount, refundDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to record refund"),
  });
}
```

- [ ] **Step 7: Create the overview hook**

Create `src/hooks/use-overview.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";

export interface OverviewFilters {
  period: "currentMonth" | "next90" | "custom";
  from?: string;
  to?: string;
  clientId?: string;
  contractStatus?: string;
  projectId?: string;
  installmentStatus?: string;
}

export interface OverviewData {
  kpis: {
    activeContractedValue: string;
    mrr: string;
    arr: string;
    cashForecast: string;
    received: string;
    overdue: string;
    upsell: string;
    downsell: string;
    activeContracts: number;
    expiringSoon: number;
  };
  monthly: Array<{ month: string; forecast: string; received: string }>;
  overdueInstallments: Array<{
    id: string;
    contractCode: string;
    contractTitle: string;
    clientName: string;
    expectedAmount: string;
    dueDate: string;
  }>;
  expiringContracts: Array<{
    id: string;
    code: string;
    title: string;
    clientName: string;
    status: string;
    endDate: string;
    officialValue: string;
  }>;
}

export function useOverview(filters: OverviewFilters) {
  return useQuery<OverviewData>({
    queryKey: ["overview", filters],
    queryFn: () =>
      fetchJson<OverviewData>(`/api/financial/overview${qs(filters)}`),
    enabled: Boolean(filters.period),
  });
}
```

- [ ] **Step 8: Create the CSV export hooks**

Create `src/hooks/use-financial-exports.ts`:

```ts
import { toastError } from "@/lib/toast";
import { qs } from "@/lib/financial/http";

export interface ContractExportFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
}

export interface ReceivablesExportFilters {
  status?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

async function downloadCsv(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Export failed");
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function exportContractsCsv(
  filters: ContractExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/contracts${qs(filters)}`,
      "contracts.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}

export async function exportReceivablesCsv(
  filters: ReceivablesExportFilters
): Promise<void> {
  try {
    await downloadCsv(
      `/api/financial/exports/receivables${qs(filters)}`,
      "receivables.csv"
    );
  } catch (error) {
    toastError((error as Error).message);
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-hooks.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/financial/http.ts src/hooks/use-clients.ts src/hooks/use-contracts.ts src/hooks/use-installments.ts src/hooks/use-overview.ts src/hooks/use-financial-exports.ts src/__tests__/financial-hooks.test.ts
git commit -m "feat(financial): add React Query hooks"
```

---

