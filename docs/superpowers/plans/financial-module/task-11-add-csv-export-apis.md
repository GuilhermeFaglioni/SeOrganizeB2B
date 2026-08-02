# Financial Module — Task 11

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 11: Add CSV Export APIs

**Files:**
- Create: `src/lib/financial/csv.ts`
- Create: `src/app/api/financial/exports/contracts/route.ts`
- Create: `src/app/api/financial/exports/receivables/route.ts`
- Create: `src/__tests__/financial-exports.test.ts`

- [ ] **Step 1: Write the failing export contract test**

Create `src/__tests__/financial-exports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("CSV exports", () => {
  it("shares stable English headers and BRL money formatting", () => {
    const csv = read("src/lib/financial/csv.ts");
    expect(csv).toContain("export function csvEscape");
    expect(csv).toContain("formatBRL");
    expect(csv).toContain("\\ufeff");
  });

  it("exports contracts respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/contracts/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).toContain("findMany");
    expect(source).toContain("status");
    expect(source).toContain("clientId");
    expect(source).not.toContain("skip:");
  });

  it("exports receivables respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/receivables/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).not.toContain("skip:");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-exports.test.ts
```

Expected: FAIL — the csv helper and export routes do not exist.

- [ ] **Step 3: Create the CSV helper**

Create `src/lib/financial/csv.ts`:

```ts
import type { Money } from "./money";
import { formatBRL } from "./money";

export function csvEscape(value: string | number | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function moneyCell(value: Money): string {
  return csvEscape(formatBRL(value));
}

export function csvDocument(rows: string[][]): string {
  const body = rows.map((row) => row.join(",")).join("\n");
  return `\ufeff${body}\n`;
}

export const CONTRACTS_CSV_HEADERS = [
  "Code",
  "Title",
  "Client",
  "Status",
  "Duration Type",
  "Official Value (BRL)",
  "Start Date",
  "End Date",
  "Billing Frequency",
  "Payment Method",
  "Owner",
] as const;

export const RECEIVABLES_CSV_HEADERS = [
  "Contract Code",
  "Contract Title",
  "Client",
  "Expected Amount (BRL)",
  "Status",
  "Due Date",
  "Payment Method",
  "Paid Date",
] as const;
```

- [ ] **Step 4: Implement the contracts export route**

Create `src/app/api/financial/exports/contracts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import {
  CONTRACTS_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";

  const where = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      client: { select: { name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows = [
    [...CONTRACTS_CSV_HEADERS],
    ...contracts.map((contract) => [
      csvEscape(contract.code),
      csvEscape(contract.title),
      csvEscape(contract.client.name),
      csvEscape(contract.status),
      csvEscape(contract.durationType),
      moneyCell(toDecimal(contract.officialValue)),
      csvEscape(contract.startDate),
      csvEscape(contract.endDate),
      csvEscape(contract.billingFrequency),
      csvEscape(contract.paymentMethod),
      csvEscape(contract.owner?.name ?? ""),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contracts.csv"',
    },
  });
}
```

- [ ] **Step 5: Implement the receivables export route**

Create `src/app/api/financial/exports/receivables/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/financial/money";
import { todayCivilDate } from "@/lib/financial/civil-date";
import {
  RECEIVABLES_CSV_HEADERS,
  csvDocument,
  csvEscape,
  moneyCell,
} from "@/lib/financial/csv";

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
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const today = todayCivilDate();

  const installments = await prisma.installment.findMany({
    where: {
      ...(status === "overdue"
        ? { status: "pending", dueDate: { lt: today } }
        : status
          ? { status }
          : {}),
      ...(clientId ? { contract: { clientId } } : {}),
      ...(projectId ? { contract: { projects: { some: { projectId } } } } : {}),
      ...(from ? { dueDate: { gte: from } } : {}),
      ...(to ? { dueDate: { lte: to } } : {}),
    },
    include: {
      contract: {
        include: { client: { select: { name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = [
    [...RECEIVABLES_CSV_HEADERS],
    ...installments.map((installment) => [
      csvEscape(installment.contract.code),
      csvEscape(installment.contract.title),
      csvEscape(installment.contract.client.name),
      moneyCell(toDecimal(installment.expectedAmount)),
      csvEscape(installment.status),
      csvEscape(installment.dueDate),
      csvEscape(installment.paymentMethod),
      csvEscape(installment.paidAt),
    ]),
  ];

  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="receivables.csv"',
    },
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-exports.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/csv.ts src/app/api/financial/exports/contracts/route.ts src/app/api/financial/exports/receivables/route.ts src/__tests__/financial-exports.test.ts
git commit -m "feat(financial): add CSV export APIs"
```

---

