# Financial Module — Task 8

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 8: Add Contracts API

**Files:**
- Create: `src/app/api/contracts/route.ts`
- Create: `src/app/api/contracts/[id]/route.ts`
- Create: `src/__tests__/financial-contracts-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-contracts-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("contracts API", () => {
  it("requires authentication on the contracts route", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("getUser()");
  });

  it("lists with server-side search, filters, sort and pagination", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("search");
    expect(source).toContain("status");
    expect(source).toContain("clientId");
    expect(source).toContain("projectId");
    expect(source).toContain("sortBy");
    expect(source).toContain("sortDir");
    expect(source).toContain("pageSize");
    expect(source).toContain("skip");
    expect(source).toContain("take");
  });

  it("creates draft contracts through the transactional service", () => {
    const source = read("src/app/api/contracts/route.ts");
    expect(source).toContain("createContractDraft");
    expect(source).toContain("VALIDATION_ERROR");
  });

  it("returns full detail with items, projects, installments, changes and audits", () => {
    const source = read("src/app/api/contracts/[id]/route.ts");
    expect(source).toContain("include:");
    expect(source).toContain("items");
    expect(source).toContain("projects");
    expect(source).toContain("installments");
    expect(source).toContain("changes");
    expect(source).toContain("audits");
  });

  it("only hard-deletes draft contracts", () => {
    const source = read("src/app/api/contracts/[id]/route.ts");
    expect(source).toContain("deleteDraftContract");
    expect(source).toContain("export async function DELETE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-contracts-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the contracts list and create route**

Create `src/app/api/contracts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { createContractDraft } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";

const SORT_FIELDS = ["code", "title", "status", "officialValue", "startDate", "endDate", "createdAt"] as const;

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
  const sortByRaw = searchParams.get("sortBy") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const sortBy = (SORT_FIELDS as readonly string[]).includes(sortByRaw)
    ? (sortByRaw as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );

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

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { installments: true } },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contract.count({ where }),
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

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Title is required" } },
      { status: 400 }
    );
  }
  if (!body.clientId) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Client is required" } },
      { status: 400 }
    );
  }
  if (!body.durationType || !["fixed", "openEnded", "oneTime"].includes(body.durationType)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid duration type is required" } },
      { status: 400 }
    );
  }
  if (typeof body.officialValue !== "string" || isNaN(Number(body.officialValue))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Official value is required" } },
      { status: 400 }
    );
  }
  if (!body.startDate || typeof body.startDate !== "string" || !isCivilDate(body.startDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid start date is required" } },
      { status: 400 }
    );
  }
  if (body.endDate && !isCivilDate(body.endDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "End date must be a valid date" } },
      { status: 400 }
    );
  }

  try {
    const contract = await createContractDraft(
      {
        title: body.title,
        clientId: body.clientId,
        ownerId: body.ownerId ?? null,
        durationType: body.durationType,
        officialValue: String(body.officialValue),
        startDate: body.startDate,
        endDate: body.endDate ?? null,
        billingFrequency: body.billingFrequency ?? null,
        paymentMethod: body.paymentMethod ?? "pix",
        documentUrl: body.documentUrl ?? null,
        notes: body.notes ?? null,
        items: body.items ?? [],
        projectIds: body.projectIds ?? [],
      },
      user.id
    );
    return NextResponse.json({ data: contract, error: null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: (error as { name?: string }).name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR",
          message: (error as Error).message,
        },
      },
      { status: (error as { name?: string }).name === "FinancialConflictError" ? 409 : 500 }
    );
  }
}
```

- [ ] **Step 4: Implement the contract detail, patch and delete route**

Create `src/app/api/contracts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  deleteDraftContract,
  updateContract,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      owner: { select: { id: true, name: true, email: true } },
      predecessor: { select: { id: true, code: true, title: true, status: true } },
      successors: { select: { id: true, code: true, title: true, status: true } },
      items: { orderBy: { position: "asc" } },
      projects: { include: { project: { select: { id: true, name: true } } } },
      installments: { orderBy: { dueDate: "asc" } },
      changes: {
        orderBy: { effectiveDate: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!contract) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Contract not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: contract, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const input: Record<string, unknown> = {};
  for (const field of [
    "title",
    "clientId",
    "ownerId",
    "durationType",
    "officialValue",
    "startDate",
    "endDate",
    "billingFrequency",
    "paymentMethod",
    "documentUrl",
    "notes",
    "status",
  ]) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.officialValue !== undefined) input.officialValue = String(input.officialValue);
  if (input.startDate !== undefined && !isCivilDate(input.startDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Start date must be a valid date" } },
      { status: 400 }
    );
  }

  try {
    const contract = await updateContract(params.id, input, user.id);
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    await deleteDraftContract(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    const name = (error as { name?: string }).name;
    const status = name === "FinancialConflictError" ? 409 : 500;
    const code = name === "FinancialConflictError" ? "CONFLICT" : "INTERNAL_ERROR";
    return NextResponse.json(
      { data: null, error: { code, message: (error as Error).message } },
      { status }
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-contracts-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/contracts/route.ts src/app/api/contracts/[id]/route.ts src/__tests__/financial-contracts-api.test.ts
git commit -m "feat(financial): add contracts API"
```

---

