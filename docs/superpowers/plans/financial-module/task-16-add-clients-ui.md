# Financial Module — Task 16

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 16: Add Clients UI

**Files:**
- Create: `src/components/financial/clients/client-list.tsx`
- Create: `src/components/financial/clients/client-form.tsx`
- Create: `src/components/financial/clients/client-detail.tsx`
- Create: `src/app/(authenticated)/financial/clients/page.tsx`
- Create: `src/app/(authenticated)/financial/clients/new/page.tsx`
- Create: `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`
- Create: `src/__tests__/financial-clients-ui.test.ts`

- [ ] **Step 1: Write the failing UI contract test**

Create `src/__tests__/financial-clients-ui.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("clients UI", () => {
  it("keeps the clients routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/clients/page.tsx",
      "src/app/(authenticated)/financial/clients/new/page.tsx",
      "src/app/(authenticated)/financial/clients/[clientId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("lists clients with search and pagination", () => {
    const list = read("src/components/financial/clients/client-list.tsx");
    expect(list).toContain("useClients");
    expect(list).toContain("search");
    expect(list).toContain("Pagination");
  });

  it("consolidates contract and revenue history on the detail", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("contracts");
    expect(detail).toContain("Contract and revenue history");
  });

  it("deactivates instead of deleting clients", () => {
    const detail = read("src/components/financial/clients/client-detail.tsx");
    expect(detail).toContain("useDeactivateClient");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-clients-ui.test.ts
```

Expected: FAIL — the components and pages do not exist.

- [ ] **Step 3: Create the client list and page**

Create `src/components/financial/clients/client-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ClientList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useClients({
    search: query || undefined,
    page,
    pageSize: 25,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load clients" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="client-search" className="sr-only">
            Search clients
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setQuery(search.trim());
                setPage(1);
              }
            }}
            placeholder="Search by name, email or CPF/CNPJ"
            className="w-64 rounded-md border border-border bg-page-alt px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setQuery(search.trim());
              setPage(1);
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
            aria-label="Search clients"
          >
            <Search size={16} aria-hidden="true" />
          </button>
        </div>
        <Link
          href="/financial/clients/new"
          className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} aria-hidden="true" /> New client
        </Link>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No clients match your search" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">CPF/CNPJ</th>
                <th scope="col" className="px-3 py-2 font-medium">Email</th>
                <th scope="col" className="px-3 py-2 font-medium">Phone</th>
                <th scope="col" className="px-3 py-2 font-medium">Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((client) => (
                <tr key={client.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/clients/${client.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{client.cpfCnpj ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client.email ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{client._count?.contracts ?? 0}</td>
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

Create `src/app/(authenticated)/financial/clients/page.tsx`:

```tsx
"use client";

import { ClientList } from "@/components/financial/clients/client-list";

export default function FinancialClientsPage() {
  return <ClientList />;
}
```

- [ ] **Step 4: Create the client form and new page**

Create `src/components/financial/clients/client-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClient, useUpdateClient } from "@/hooks/use-clients";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientForm({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (clientId) {
      updateClient.mutate(
        {
          id: clientId,
          name: name || undefined,
          legalName: legalName || undefined,
          cpfCnpj: cpfCnpj || undefined,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
        },
        { onSuccess: () => router.push(`/financial/clients/${clientId}`) }
      );
      return;
    }
    createClient.mutate(
      {
        name,
        legalName: legalName || undefined,
        cpfCnpj: cpfCnpj || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: (client) => {
          toastSuccess("Client created");
          router.push(`/financial/clients/${(client as { id: string }).id}`);
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-4 rounded-xl border border-border bg-page-alt p-4">
        <div>
          <Label htmlFor="client-name">Name</Label>
          <Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-legal">Legal name</Label>
          <Input id="client-legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-doc">CPF/CNPJ</Label>
          <Input id="client-doc" value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-email">Email</Label>
          <Input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-phone">Phone</Label>
          <Input id="client-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-notes">Notes</Label>
          <textarea
            id="client-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
          />
        </div>
      </div>
      <Button disabled={!name.trim()} onClick={submit}>
        {clientId ? "Save changes" : "Create client"}
      </Button>
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/clients/new/page.tsx`:

```tsx
"use client";

import { ClientForm } from "@/components/financial/clients/client-form";

export default function NewClientPage() {
  return <ClientForm />;
}
```

- [ ] **Step 5: Create the client detail and route page**

Create `src/components/financial/clients/client-detail.tsx`:

```tsx
"use client";

import { useClient } from "@/hooks/use-clients";
import { useDeactivateClient } from "@/hooks/use-clients";
import { toDecimal, sum } from "@/lib/financial/money";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

interface ClientContract {
  id: string;
  code: string;
  title: string;
  status: string;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  _count?: { projects: number };
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const { data: client, isLoading, isError, refetch } = useClient(clientId);
  const deactivate = useDeactivateClient();

  if (isLoading) return <LoadingState />;
  if (isError || !client) {
    return <FinancialErrorState message="Failed to load the client" onRetry={() => refetch()} />;
  }

  const contracts = (client.contracts ?? []) as ClientContract[];
  const revenue = sum(
    contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => toDecimal(contract.officialValue))
  );
  const activeProjects = contracts.reduce(
    (acc, contract) => acc + (contract._count?.projects ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{client.name}</h1>
          {client.legalName && (
            <p className="text-sm text-text-secondary">{client.legalName}</p>
          )}
          <p className="mt-1 text-sm text-text-muted">
            {client.cpfCnpj ?? "—"} · {client.email ?? "—"} · {client.phone ?? "—"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => deactivate.mutate(client.id)}
          disabled={!client.active}
        >
          {client.active ? "Deactivate" : "Inactive"}
        </Button>
      </div>

      <section aria-labelledby="client-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Contracts</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{contracts.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Active contracted value</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            <MoneyText value={revenue.toFixed(2)} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Linked projects</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{activeProjects}</p>
        </div>
      </section>

      <section aria-labelledby="client-history" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="client-history" className="mb-3 text-base font-semibold text-text-primary">
          Contract and revenue history
        </h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-text-muted">No contracts recorded for this client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Code</th>
                  <th scope="col" className="px-3 py-1 font-medium">Title</th>
                  <th scope="col" className="px-3 py-1 font-medium">Status</th>
                  <th scope="col" className="px-3 py-1 font-medium">Official value</th>
                  <th scope="col" className="px-3 py-1 font-medium">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-3 py-1 font-mono text-xs text-text-secondary">{contract.code}</td>
                    <td className="px-3 py-1 font-medium">{contract.title}</td>
                    <td className="px-3 py-1"><StatusBadge status={contract.status} /></td>
                    <td className="px-3 py-1 font-medium"><MoneyText value={contract.officialValue} /></td>
                    <td className="px-3 py-1 text-text-secondary">
                      <CivilDateText date={contract.startDate} /> — <CivilDateText date={contract.endDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
```

Create `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`:

```tsx
"use client";

import { ClientDetail } from "@/components/financial/clients/client-detail";

export default function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  return <ClientDetail clientId={params.clientId} />;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-clients-ui.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/financial/clients/client-list.tsx src/components/financial/clients/client-form.tsx src/components/financial/clients/client-detail.tsx "src/app/(authenticated)/financial/clients/page.tsx" "src/app/(authenticated)/financial/clients/new/page.tsx" "src/app/(authenticated)/financial/clients/[clientId]/page.tsx" src/__tests__/financial-clients-ui.test.ts
git commit -m "feat(financial): add clients UI"
```

---

