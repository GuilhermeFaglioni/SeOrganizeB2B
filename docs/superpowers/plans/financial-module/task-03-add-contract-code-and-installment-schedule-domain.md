# Financial Module — Task 3

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 3: Add Contract Code and Installment Schedule Domain

**Files:**
- Create: `src/lib/financial/contract-code.ts`
- Create: `src/lib/financial/installments.ts`
- Create: `src/__tests__/financial-installments.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-installments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contractCode } from "../lib/financial/contract-code";
import {
  installmentCount,
  splitEqualInstallments,
  suggestFinitePlan,
  sumPlan,
  validateFinitePlan,
  recurringPlanForHorizon,
  suggestPlan,
} from "../lib/financial/installments";
import { toDecimal, eq, moneyToJson } from "../lib/financial/money";

describe("contract code", () => {
  it("formats CTR-YYYY-NNNN", () => {
    expect(contractCode(2026, 1)).toBe("CTR-2026-0001");
    expect(contractCode(2026, 9999)).toBe("CTR-2026-9999");
  });
});

describe("equal installment split", () => {
  it("splits evenly and puts the cent remainder in the final installment", () => {
    const parts = splitEqualInstallments(toDecimal("100.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("handles exact division", () => {
    const parts = splitEqualInstallments(toDecimal("99.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.00", "33.00", "33.00"]);
  });

  it("guards against a zero count", () => {
    expect(splitEqualInstallments(toDecimal("100"), 0)).toEqual([]);
  });
});

describe("finite plans", () => {
  it("counts monthly, quarterly, semiannual and annual periods", () => {
    expect(installmentCount("2026-01-01", "2026-12-01", "monthly")).toBe(12);
    expect(installmentCount("2026-01-01", "2026-12-01", "quarterly")).toBe(4);
    expect(installmentCount("2026-01-01", "2026-12-01", "semiannual")).toBe(2);
    expect(installmentCount("2026-01-01", "2026-12-01", "annual")).toBe(1);
  });

  it("suggests a plan whose total equals the official value", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    expect(plan).toHaveLength(12);
    expect(eq(sumPlan(plan), toDecimal("1200.00"))).toBe(true);
    expect(plan[0].dueDate).toBe("2026-01-01");
    expect(plan[0].paymentMethod).toBe("pix");
  });

  it("validates exact sums for finite contracts", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    plan[0] = { ...plan[0], expectedAmount: "100.00" };
    expect(validateFinitePlan(plan, toDecimal("1200.00"))).not.toHaveLength(0);
    expect(
      validateFinitePlan([], toDecimal("1200.00"))
    ).toContain("At least one installment is required");
  });
});

describe("recurring horizon", () => {
  it("builds a rolling window without duplicate cycle keys", () => {
    const plan = recurringPlanForHorizon(
      "2026-08-02",
      toDecimal("500.00"),
      0,
      3,
      "boleto"
    );
    expect(plan).toHaveLength(4);
    expect(plan[0].cycleKey).toBe("2026-08");
    expect(plan[1].cycleKey).toBe("2026-09");
    expect(plan[3].expectedAmount).toBe("500.00");
    expect(new Set(plan.map((p) => p.cycleKey)).size).toBe(4);
  });

  it("suggests a single installment for one-time contracts", () => {
    const plan = suggestPlan(
      toDecimal("3000.00"),
      "oneTime",
      "2026-08-02",
      null,
      null,
      "pix"
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].dueDate).toBe("2026-08-02");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-installments.test.ts
```

Expected: FAIL — the modules do not exist yet.

- [ ] **Step 3: Create the contract code helper**

Create `src/lib/financial/contract-code.ts`:

```ts
export function contractCode(year: number, sequence: number): string {
  return `CTR-${year}-${String(sequence).padStart(4, "0")}`;
}
```

- [ ] **Step 4: Create the installment schedule helpers**

Create `src/lib/financial/installments.ts`:

```ts
import type {
  BillingFrequency,
  DurationType,
  InstallmentPlanItem,
  PaymentMethod,
} from "./types";
import { addMonthsCivil, diffMonths } from "./civil-date";
import {
  Money,
  div,
  fromCents,
  moneyToJson,
  sub,
  sum,
  toCents,
  toDecimal,
  eq,
} from "./money";

export function monthStep(frequency: BillingFrequency): number {
  if (frequency === "monthly") return 1;
  if (frequency === "quarterly") return 3;
  if (frequency === "semiannual") return 6;
  return 12;
}

export function installmentCount(
  startDate: string,
  endDate: string,
  frequency: BillingFrequency
): number {
  return Math.floor(diffMonths(startDate, endDate) / monthStep(frequency)) + 1;
}

export function splitEqualInstallments(total: Money, count: number): Money[] {
  if (count < 1) return [];
  const totalCents = toCents(total);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  const amounts: Money[] = Array.from(
    { length: count },
    () => fromCents(baseCents)
  );
  if (remainder > 0) {
    amounts[count - 1] = fromCents(baseCents + remainder);
  }
  return amounts;
}

export function suggestFinitePlan(
  officialValue: Money,
  startDate: string,
  endDate: string,
  frequency: BillingFrequency,
  paymentMethod: PaymentMethod
): InstallmentPlanItem[] {
  const count = installmentCount(startDate, endDate, frequency);
  const amounts = splitEqualInstallments(officialValue, count);
  return amounts.map((amount, index) => ({
    expectedAmount: moneyToJson(amount),
    dueDate: addMonthsCivil(startDate, index * monthStep(frequency)),
    paymentMethod,
  }));
}

export function recurringCycleDueDate(startDate: string, index: number): string {
  return addMonthsCivil(startDate, index);
}

export function recurringCycleKey(startDate: string, index: number): string {
  return recurringCycleDueDate(startDate, index).slice(0, 7);
}

export function recurringPlanForHorizon(
  startDate: string,
  cycleValue: Money,
  startIndex: number,
  endIndex: number,
  paymentMethod: PaymentMethod
): Array<InstallmentPlanItem & { cycleKey: string }> {
  const items: Array<InstallmentPlanItem & { cycleKey: string }> = [];
  for (let index = startIndex; index <= endIndex; index++) {
    items.push({
      expectedAmount: moneyToJson(cycleValue),
      dueDate: recurringCycleDueDate(startDate, index),
      paymentMethod,
      cycleKey: recurringCycleKey(startDate, index),
    });
  }
  return items;
}

export function suggestPlan(
  officialValue: Money,
  durationType: DurationType,
  startDate: string,
  endDate: string | null,
  billingFrequency: BillingFrequency | null,
  paymentMethod: PaymentMethod
): InstallmentPlanItem[] {
  if (durationType === "oneTime") {
    return [{ expectedAmount: moneyToJson(officialValue), dueDate: startDate, paymentMethod }];
  }
  if (durationType === "openEnded") {
    return recurringPlanForHorizon(startDate, officialValue, 0, 11, paymentMethod);
  }
  const frequency = billingFrequency ?? "monthly";
  return suggestFinitePlan(
    officialValue,
    startDate,
    endDate ?? startDate,
    frequency,
    paymentMethod
  );
}

export function sumPlan(plan: InstallmentPlanItem[]): Money {
  return sum(plan.map((item) => toDecimal(item.expectedAmount)));
}

export function validateFinitePlan(
  plan: InstallmentPlanItem[],
  officialValue: Money
): string[] {
  const errors: string[] = [];
  if (plan.length === 0) errors.push("At least one installment is required");
  if (!eq(sumPlan(plan), officialValue)) {
    errors.push("Installment total must equal the official contract value");
  }
  return errors;
}

export function planTotal(plan: InstallmentPlanItem[]): Money {
  return sum(plan.map((item) => toDecimal(item.expectedAmount)));
}
```

Note: `planTotal` is used by the contract form to show the item-price and
installment consistency summary; `sub` is imported for `adjustmentPlanItem` in
Task 5 but is unused here — remove `sub` from this import list to keep
TypeScript strict (`noUnusedLocals`) clean.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-installments.test.ts
```

Expected: PASS. If `tsc --noEmit` later reports an unused import, drop it in
this file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/financial/contract-code.ts src/lib/financial/installments.ts src/__tests__/financial-installments.test.ts
git commit -m "feat(financial): add installment schedule domain"
```

---

