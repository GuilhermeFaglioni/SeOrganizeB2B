# Financial Module — Task 10

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 10: Add Overview API

**Files:**
- Create: `src/app/api/financial/overview/route.ts`
- Create: `src/__tests__/financial-overview-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-overview-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("overview API", () => {
  it("aggregates on the server and requires authentication", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("computeOverview");
    expect(source).toContain("export async function GET");
  });

  it("accepts period, client, status, project and installment filters", () => {
    const source = read("src/app/api/financial/overview/route.ts");
    expect(source).toContain("period");
    expect(source).toContain("clientId");
    expect(source).toContain("contractStatus");
    expect(source).toContain("projectId");
    expect(source).toContain("installmentStatus");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-overview-api.test.ts
```

Expected: FAIL — the route file does not exist.

- [ ] **Step 3: Implement the overview route**

Create `src/app/api/financial/overview/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { computeOverview } from "@/lib/financial/overview-service";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const periodRaw = searchParams.get("period") || "currentMonth";
  const period = ["currentMonth", "next90", "custom"].includes(periodRaw)
    ? (periodRaw as "currentMonth" | "next90" | "custom")
    : "currentMonth";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const contractStatus = searchParams.get("contractStatus") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const installmentStatus = searchParams.get("installmentStatus") || undefined;

  const data = await computeOverview({
    period,
    from,
    to,
    clientId,
    contractStatus,
    projectId,
    installmentStatus,
  });

  return NextResponse.json({ data, error: null });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-overview-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/financial/overview/route.ts src/__tests__/financial-overview-api.test.ts
git commit -m "feat(financial): add overview API"
```

---

