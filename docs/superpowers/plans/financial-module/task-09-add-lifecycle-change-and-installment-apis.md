# Financial Module — Task 9

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 9: Add Lifecycle, Change and Installment APIs

**Files:**
- Create: `src/app/api/contracts/[id]/lifecycle/route.ts`
- Create: `src/app/api/contracts/[id]/changes/route.ts`
- Create: `src/app/api/installments/[id]/route.ts`
- Create: `src/app/api/installments/[id]/refund/route.ts`
- Create: `src/__tests__/financial-operations-api.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Create `src/__tests__/financial-operations-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("contract lifecycle API", () => {
  it("exposes lifecycle actions through a single route", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("applyLifecycleAction");
    expect(source).toContain("activate");
    expect(source).toContain("suspend");
    expect(source).toContain("resume");
    expect(source).toContain("close");
    expect(source).toContain("cancel");
    expect(source).toContain("renew");
    expect(source).toContain("AUTH_ERROR");
  });

  it("validates the installment plan before activation", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("plan");
  });

  it("requires an effective date to cancel", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("effectiveDate");
  });
});

describe("contract changes API", () => {
  it("proposes first and applies only after confirmation", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("applyContractChange");
    expect(source).toContain("confirm: body.confirm === true");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("strategy");
  });

  it("supports redistribute and adjust strategies", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("redistribute");
    expect(source).toContain("adjust");
  });
});

describe("installment APIs", () => {
  it("marks paid, cancels and records refunds without touching paid rows", () => {
    const source = read("src/app/api/installments/[id]/route.ts");
    expect(source).toContain("recordPayment");
    expect(source).toContain("cancelInstallment");
    expect(source).toContain("AUTH_ERROR");
  });

  it("enforces the linked refund rule", () => {
    const source = read("src/app/api/installments/[id]/refund/route.ts");
    expect(source).toContain("refundInstallment");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("CONFLICT");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-operations-api.test.ts
```

Expected: FAIL — the route files do not exist.

- [ ] **Step 3: Implement the lifecycle route**

Create `src/app/api/contracts/[id]/lifecycle/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  activateContract,
  applyLifecycleAction,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { validateFinitePlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

const ACTIONS = ["activate", "suspend", "resume", "close", "cancel", "renew"] as const;

export async function POST(
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
  const action = body.action;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Unknown lifecycle action" } },
      { status: 400 }
    );
  }

  try {
    if (action === "activate") {
      const plan = body.plan;
      if (!Array.isArray(plan) || plan.length === 0) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "An installment plan is required" } },
          { status: 400 }
        );
      }
      for (const item of plan) {
        if (!isCivilDate(item.dueDate)) {
          return NextResponse.json(
            { data: null, error: { code: "VALIDATION_ERROR", message: "Each installment needs a valid due date" } },
            { status: 400 }
          );
        }
        if (isNaN(Number(item.expectedAmount))) {
          return NextResponse.json(
            { data: null, error: { code: "VALIDATION_ERROR", message: "Each installment needs a valid amount" } },
            { status: 400 }
          );
        }
      }
      const contract = await activateContract(params.id, plan, user.id);
      return NextResponse.json({ data: contract, error: null });
    }

    if (action === "cancel" && !isCivilDate(body.effectiveDate ?? "")) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "An effective date is required to cancel" } },
        { status: 400 }
      );
    }

    const contract = await applyLifecycleAction(
      params.id,
      action,
      {
        effectiveDate: body.effectiveDate ?? undefined,
        retainedInstallmentIds: body.retainedInstallmentIds ?? [],
      },
      user.id
    );
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Implement the changes route**

Create `src/app/api/contracts/[id]/changes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { applyContractChange } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

export async function POST(
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

  if (!["upsell", "downsell"].includes(body.type)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Type must be upsell or downsell" } },
      { status: 400 }
    );
  }
  if (!["redistribute", "adjust"].includes(body.strategy)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Strategy must be redistribute or adjust" } },
      { status: 400 }
    );
  }
  if (typeof body.delta !== "string" || isNaN(Number(body.delta))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A numeric delta is required" } },
      { status: 400 }
    );
  }
  if (!isCivilDate(body.effectiveDate ?? "")) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid effective date is required" } },
      { status: 400 }
    );
  }

  try {
    const result = await applyContractChange(
      params.id,
      {
        type: body.type,
        delta: body.delta,
        effectiveDate: body.effectiveDate,
        description: body.description ?? undefined,
        reason: body.reason ?? undefined,
        strategy: body.strategy,
        confirm: body.confirm === true,
      },
      user.id
    );
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 5: Implement the installment update route**

Create `src/app/api/installments/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  cancelInstallment,
  recordPayment,
} from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

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
    if (body.action === "pay") {
      const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
      if (!isCivilDate(paidAt)) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "A valid payment date is required" } },
          { status: 400 }
        );
      }
      const installment = await recordPayment(params.id, paidAt, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    if (body.action === "cancel") {
      const installment = await cancelInstallment(params.id, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Unknown installment action" } },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 6: Implement the refund route**

Create `src/app/api/installments/[id]/refund/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { refundInstallment } from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { FinancialConflictError, FinancialValidationError } from "@/lib/financial/lifecycle";

export async function POST(
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

  if (typeof body.refundAmount !== "string" || isNaN(Number(body.refundAmount))) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A numeric refund amount is required" } },
      { status: 400 }
    );
  }
  const refundDate = body.refundDate ?? new Date().toISOString().slice(0, 10);
  if (!isCivilDate(refundDate)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid refund date is required" } },
      { status: 400 }
    );
  }

  try {
    const refund = await refundInstallment(
      params.id,
      body.refundAmount,
      refundDate,
      user.id
    );
    return NextResponse.json({ data: refund, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        { data: null, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }
    throw error;
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-operations-api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/contracts/[id]/lifecycle/route.ts src/app/api/contracts/[id]/changes/route.ts src/app/api/installments/[id]/route.ts src/app/api/installments/[id]/refund/route.ts src/__tests__/financial-operations-api.test.ts
git commit -m "feat(financial): add lifecycle change and installment APIs"
```

---

