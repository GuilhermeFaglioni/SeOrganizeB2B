# Financial Module — Task 7

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 7: Add Clients API

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/clients/[id]/route.ts`
- Create: `src/__tests__/financial-clients-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-clients-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("clients API", () => {
  it("requires authentication on list and create", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("getUser()");
    expect(source).toContain("export async function GET");
    expect(source).toContain("export async function POST");
  });

  it("lists with server-side search and pagination", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("search");
    expect(source).toContain("page");
    expect(source).toContain("pageSize");
    expect(source).toContain("totalPages");
  });

  it("rejects duplicate cpf/cnpj as a conflict", () => {
    const source = read("src/app/api/clients/route.ts");
    expect(source).toContain("P2002");
    expect(source).toContain("CONFLICT");
  });

  it("deactivates clients through a patch and never hard-deletes", () => {
    const source = read("src/app/api/clients/[id]/route.ts");
    expect(source).toContain("body.active");
    expect(source).toContain("export async function PATCH");
    expect(source).not.toContain("export async function DELETE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-clients-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the clients list and create route**

Create `src/app/api/clients/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
  );
  const activeOnly = searchParams.get("active") !== "false";

  const where = {
    ...(activeOnly ? { active: true } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { cpfCnpj: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { contracts: true } } },
    }),
    prisma.client.count({ where }),
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
  const { name, legalName, cpfCnpj, email, phone, notes } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        legalName: legalName || null,
        cpfCnpj: cpfCnpj || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ data: client, error: null }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Implement the client detail, patch and deactivate route**

Create `src/app/api/clients/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

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

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { projects: true } },
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: client, error: null });
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

  try {
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        legalName: body.legalName !== undefined ? body.legalName : undefined,
        cpfCnpj: body.cpfCnpj !== undefined ? body.cpfCnpj || null : undefined,
        email: body.email !== undefined ? body.email || null : undefined,
        phone: body.phone !== undefined ? body.phone || null : undefined,
        notes: body.notes !== undefined ? body.notes || null : undefined,
        active: body.active !== undefined ? body.active : undefined,
      },
    });
    return NextResponse.json({ data: client, error: null });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: "CPF/CNPJ is already in use" } },
        { status: 409 }
      );
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }
    throw error;
  }
}
```

There is intentionally no `DELETE`: clients with financial history are
deactivated via `PATCH { active: false }`, which matches the spec rule.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-clients-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/clients/route.ts src/app/api/clients/[id]/route.ts src/__tests__/financial-clients-api.test.ts
git commit -m "feat(financial): add clients API"
```

---

