# Financial Module — Task 5

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 5: Add Lifecycle and Upsell/Downsell Rules

**Files:**
- Create: `src/lib/financial/lifecycle.ts`
- Create: `src/lib/financial/changes.ts`
- Create: `src/lib/financial/audit.ts`
- Create: `src/__tests__/financial-lifecycle.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FinancialConflictError,
  activationErrors,
  transition,
  cancellationPlan,
  renewablePredecessor,
} from "../lib/financial/lifecycle";
import {
  redistributeDelta,
  validateDownsell,
  validateRedistributedPlan,
  adjustmentPlanItem,
} from "../lib/financial/changes";
import { toDecimal, moneyToJson, isNegative } from "../lib/financial/money";

const draftContract = {
  clientId: "client-1",
  title: "Engagement",
  durationType: "fixed",
  officialValue: toDecimal("1200.00"),
  startDate: "2026-01-01",
  endDate: "2026-12-01",
  billingFrequency: "monthly",
  status: "draft",
} as const;

describe("transitions", () => {
  it("applies the documented lifecycle", () => {
    expect(transition("draft", "activate")).toBe("active");
    expect(transition("active", "suspend")).toBe("suspended");
    expect(transition("suspended", "resume")).toBe("active");
    expect(transition("active", "close")).toBe("closed");
    expect(transition("active", "cancel")).toBe("cancelled");
  });

  it("rejects invalid transitions with a conflict error", () => {
    expect(() => transition("closed", "activate")).toThrow(FinancialConflictError);
    expect(() => transition("cancelled", "resume")).toThrow(FinancialConflictError);
  });
});

describe("activation rules", () => {
  it("accepts a complete fixed contract with a matching plan", () => {
    const plan = [
      { expectedAmount: "100.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
      { expectedAmount: "100.00", dueDate: "2026-02-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors({ ...draftContract, officialValue: toDecimal("200.00") }, plan);
    expect(errors).toEqual([]);
  });

  it("rejects missing fields and inconsistent dates", () => {
    const errors = activationErrors(
      { ...draftContract, clientId: "", endDate: "2025-01-01" },
      [{ expectedAmount: "1200.00", dueDate: "2026-01-01", paymentMethod: "pix" }]
    );
    expect(errors).toContain("A client is required");
    expect(errors).toContain("End date must not precede the start date");
  });
});

describe("cancellation plan", () => {
  it("cancels only future pending installments while keeping retained ones", () => {
    const installments = [
      { id: "a", status: "pending" as const, dueDate: "2026-08-15" },
      { id: "b", status: "pending" as const, dueDate: "2026-08-05" },
      { id: "c", status: "pending" as const, dueDate: "2026-09-01" },
      { id: "d", status: "paid" as const, dueDate: "2026-10-01" },
    ];
    expect(
      cancellationPlan(installments, "2026-08-10", ["c"])
    ).toEqual(["a"]);
  });
});

describe("renewal", () => {
  it("accepts active and suspended predecessors", () => {
    expect(renewablePredecessor("active")).toBe(true);
    expect(renewablePredecessor("suspended")).toBe(true);
    expect(renewablePredecessor("closed")).toBe(false);
    expect(renewablePredecessor("cancelled")).toBe(false);
  });
});

describe("upsell and downsell", () => {
  const pending = [
    { id: "1", expectedAmount: toDecimal("100.00") },
    { id: "2", expectedAmount: toDecimal("100.00") },
    { id: "3", expectedAmount: toDecimal("100.00") },
  ];

  it("redistributes an upsell delta across pending installments", () => {
    const adjusted = redistributeDelta(pending, toDecimal("30.00"), "upsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "110.00",
      "110.00",
      "110.00",
    ]);
  });

  it("redistributes a downsell delta proportionally", () => {
    const adjusted = redistributeDelta(pending, toDecimal("3.00"), "downsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "99.00",
      "99.00",
      "99.00",
    ]);
  });

  it("rejects invalid downsells and negative redistributions", () => {
    expect(validateDownsell(toDecimal("100.00"), toDecimal("150.00"))).toContain(
      "Downsell cannot make the contract value negative"
    );
    const plan = [
      { expectedAmount: toDecimal("0.50") },
      { expectedAmount: toDecimal("0.50") },
    ];
    const bad = redistributeDelta(plan, toDecimal("3.00"), "downsell");
    expect(validateRedistributedPlan(bad)).not.toHaveLength(0);
    expect(bad.some((b) => isNegative(b.expectedAmount))).toBe(true);
  });

  it("builds a negative adjustment item for downsell", () => {
    const item = adjustmentPlanItem(
      "downsell",
      toDecimal("200.00"),
      "2026-08-15",
      "pix"
    );
    expect(moneyToJson(toDecimal(item.expectedAmount))).toBe("-200.00");
    expect(item.dueDate).toBe("2026-08-15");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-lifecycle.test.ts
```

Expected: FAIL — the three modules do not exist yet.

- [ ] **Step 3: Implement the lifecycle rules**

Create `src/lib/financial/lifecycle.ts`:

```ts
import type {
  ContractStatus,
  InstallmentPlanItem,
  LifecycleAction,
} from "./types";
import { compareCivil } from "./civil-date";
import { Money, eq } from "./money";
import { validateFinitePlan, sumPlan } from "./installments";

export class FinancialConflictError extends Error {}

export class FinancialValidationError extends Error {}

const TRANSITIONS: Record<ContractStatus, Partial<Record<LifecycleAction, ContractStatus>>> = {
  draft: { activate: "active", cancel: "cancelled" },
  active: { suspend: "suspended", close: "closed", cancel: "cancelled" },
  suspended: { resume: "active", close: "closed", cancel: "cancelled" },
  closed: {},
  cancelled: {},
};

export function transition(
  current: string,
  action: LifecycleAction
): ContractStatus {
  const next = TRANSITIONS[current as ContractStatus]?.[action];
  if (!next) {
    throw new FinancialConflictError(
      `Cannot ${action} a contract in status ${current}`
    );
  }
  return next;
}

export function renewablePredecessor(status: string): boolean {
  return status === "active" || status === "suspended";
}

interface ContractForActivation {
  clientId: string;
  title: string;
  durationType: string;
  officialValue: Money;
  startDate: string;
  endDate: string | null;
  billingFrequency: string | null;
}

export function activationErrors(
  contract: ContractForActivation,
  plan: InstallmentPlanItem[]
): string[] {
  const errors: string[] = [];
  if (!contract.clientId) errors.push("A client is required");
  if (!contract.title.trim()) errors.push("A title is required");
  if (!contract.startDate) errors.push("A start date is required");
  if (contract.endDate && compareCivil(contract.endDate, contract.startDate) < 0) {
    errors.push("End date must not precede the start date");
  }
  if (
    contract.durationType === "openEnded" &&
    !contract.billingFrequency
  ) {
    errors.push("A billing frequency is required for recurring contracts");
  }
  if (contract.durationType !== "openEnded") {
    errors.push(...validateFinitePlan(plan, contract.officialValue));
  } else if (!eq(sumPlan(plan), contract.officialValue)) {
    errors.push("Installment total must equal the official contract value");
  }
  return errors;
}

export function cancellationPlan(
  installments: Array<{
    id: string;
    status: string;
    dueDate: string;
  }>,
  effectiveDate: string,
  retainedIds: string[]
): string[] {
  return installments
    .filter((i) => i.status === "pending")
    .filter((i) => !retainedIds.includes(i.id))
    .filter((i) => compareCivil(i.dueDate, effectiveDate) > 0)
    .map((i) => i.id);
}
```

- [ ] **Step 4: Implement the upsell/downsell rules**

Create `src/lib/financial/changes.ts`:

```ts
import type { ChangeType, InstallmentPlanItem, PaymentMethod } from "./types";
import { isNegative, lt, Money, neg, sub, sum, toCents, toDecimal, fromCents, gt, moneyToJson } from "./money";

export interface PendingInstallment {
  id: string;
  expectedAmount: Money;
}

export function redistributeDelta(
  pending: PendingInstallment[],
  delta: Money,
  type: ChangeType
): PendingInstallment[] {
  if (pending.length === 0) return [];
  const sign = type === "upsell" ? 1 : -1;
  const totalPending = sum(pending.map((p) => p.expectedAmount));
  const totalCents = toCents(totalPending);
  if (totalCents === 0) {
    return pending.map((p) => ({ id: p.id, expectedAmount: p.expectedAmount }));
  }
  const deltaCents = toCents(delta);
  const shares = pending.map((p) =>
    Math.floor((toCents(p.expectedAmount) / totalCents) * deltaCents)
  );
  let remaining = deltaCents - shares.reduce((acc, s) => acc + s, 0);
  for (let i = 0; i < shares.length && remaining > 0; i++) {
    shares[i] += 1;
    remaining -= 1;
  }
  return pending.map((p, i) => ({
    id: p.id,
    expectedAmount: fromCents(
      toCents(p.expectedAmount) + sign * shares[i]
    ),
  }));
}

export function validateRedistributedPlan(
  plan: PendingInstallment[]
): string[] {
  return plan
    .filter((p) => isNegative(p.expectedAmount))
    .map(() => "Redistribution would create a negative installment");
}

export function validateDownsell(officialValue: Money, delta: Money): string[] {
  const errors: string[] = [];
  if (!gt(delta, toDecimal(0))) errors.push("Delta must be greater than zero");
  if (lt(officialValue, delta)) {
    errors.push("Downsell cannot make the contract value negative");
  }
  return errors;
}

export function adjustmentPlanItem(
  type: ChangeType,
  delta: Money,
  effectiveDate: string,
  paymentMethod: PaymentMethod
): InstallmentPlanItem {
  return {
    expectedAmount: moneyToJson(type === "downsell" ? neg(delta) : delta),
    dueDate: effectiveDate,
    paymentMethod,
  };
}
```

Note: `sub` is imported but unused in this file — remove it from the import
list before committing so `tsc --noEmit` stays clean.

- [ ] **Step 5: Implement the audit recorder**

Create `src/lib/financial/audit.ts`:

```ts
import type { Prisma } from "@prisma/client";

export interface FinancialAuditInput {
  contractId: string;
  actorId: string | null;
  field: string;
  beforeValue?: Prisma.InputJsonValue;
  afterValue?: Prisma.InputJsonValue;
  reason?: string | null;
}

export async function recordFinancialAudit(
  tx: Prisma.TransactionClient,
  input: FinancialAuditInput
): Promise<void> {
  await tx.contractAudit.create({
    data: {
      contractId: input.contractId,
      actorId: input.actorId,
      field: input.field,
      ...(input.beforeValue !== undefined
        ? { beforeValue: input.beforeValue }
        : {}),
      ...(input.afterValue !== undefined
        ? { afterValue: input.afterValue }
        : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
}
```

> Consistency note: callers must pass `Prisma.InputJsonValue`-compatible values
> (strings, numbers, booleans, JSON objects/arrays). Use the `afterValue`
> field for single-sided entries and omit `beforeValue` instead of passing
> `null`.

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/lifecycle.ts src/lib/financial/changes.ts src/lib/financial/audit.ts src/__tests__/financial-lifecycle.test.ts
git commit -m "feat(financial): add lifecycle and change rules"
```

---

