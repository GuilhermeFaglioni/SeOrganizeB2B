# Financial Module — Task 4

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 4: Add Revenue Metrics Domain

**Files:**
- Create: `src/lib/financial/metrics.ts`
- Create: `src/__tests__/financial-metrics.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  monthlyValue,
  mrrForContract,
  arrForContract,
  forecastTotal,
  receivedTotal,
  overdueTotal,
  groupMonthly,
  isExpiringSoon,
  activeContractedValue,
  sumChangeDeltas,
} from "../lib/financial/metrics";
import { toDecimal, moneyToJson } from "../lib/financial/money";

const contract = (
  durationType: string,
  officialValue: string,
  startDate: string,
  endDate: string | null,
  billingFrequency: string | null
) => ({
  officialValue: toDecimal(officialValue),
  durationType,
  startDate,
  endDate,
  billingFrequency,
});

describe("MRR and ARR", () => {
  it("normalizes every recurring frequency", () => {
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "monthly"))).toBe("1200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "quarterly"))).toBe("400.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "semiannual"))).toBe("200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "annual"))).toBe("100.00");
  });

  it("computes MRR and ARR for open-ended recurring contracts", () => {
    const openEnded = contract("openEnded", "1200.00", "2026-08-02", null, "monthly");
    expect(moneyToJson(mrrForContract(openEnded)!) ).toBe("1200.00");
    expect(moneyToJson(arrForContract(openEnded)!)).toBe("14400.00");
  });

  it("computes fixed-term MRR from the term and returns null for one-time", () => {
    const fixed = contract("fixed", "12000.00", "2026-01-01", "2026-12-01", "monthly");
    expect(moneyToJson(mrrForContract(fixed)!)).toBe("1000.00");
    const oneTime = contract("oneTime", "5000.00", "2026-08-02", null, null);
    expect(mrrForContract(oneTime)).toBeNull();
  });
});

describe("forecast, received and overdue", () => {
  const installments = [
    { status: "pending", expectedAmount: toDecimal("1000"), dueDate: "2026-08-15", paidAt: null },
    { status: "paid", expectedAmount: toDecimal("500"), dueDate: "2026-08-01", paidAt: "2026-08-02" },
    { status: "cancelled", expectedAmount: toDecimal("700"), dueDate: "2026-09-01", paidAt: null },
    { status: "pending", expectedAmount: toDecimal("300"), dueDate: "2026-07-31", paidAt: null },
  ];

  it("groups non-cancelled forecast and received by month boundaries", () => {
    expect(moneyToJson(forecastTotal(installments, "2026-08-01", "2026-08-31"))).toBe("1500.00");
    expect(moneyToJson(receivedTotal(installments, "2026-08-01", "2026-08-31"))).toBe("500.00");
  });

  it("derives overdue from pending installments due before today", () => {
    expect(moneyToJson(overdueTotal(installments, "2026-08-02"))).toBe("300.00");
  });

  it("builds monthly chart points for the selected range", () => {
    const points = groupMonthly(installments, "2026-08-01", "2026-09-30");
    expect(points.map((p) => p.month)).toEqual(["2026-08", "2026-09"]);
    expect(moneyToJson(points[0].forecast)).toBe("1500.00");
    expect(moneyToJson(points[0].received)).toBe("500.00");
    expect(moneyToJson(points[1].forecast)).toBe("0.00");
  });
});

describe("contract metrics", () => {
  it("detects expiring contracts within the next 30 days", () => {
    expect(isExpiringSoon("2026-08-20", "2026-08-02")).toBe(true);
    expect(isExpiringSoon("2026-10-01", "2026-08-02")).toBe(false);
    expect(isExpiringSoon("2026-08-01", "2026-08-02")).toBe(false);
  });

  it("sums only active fixed and one-time official values", () => {
    const contracts = [
      { status: "active", durationType: "fixed", officialValue: toDecimal("1000") },
      { status: "active", durationType: "openEnded", officialValue: toDecimal("2000") },
      { status: "closed", durationType: "fixed", officialValue: toDecimal("3000") },
    ];
    expect(moneyToJson(activeContractedValue(contracts))).toBe("1000.00");
  });

  it("separates upsell and downsell sums by effective date", () => {
    const changes = [
      { type: "upsell", delta: toDecimal("500"), effectiveDate: "2026-08-10" },
      { type: "downsell", delta: toDecimal("200"), effectiveDate: "2026-08-15" },
      { type: "upsell", delta: toDecimal("100"), effectiveDate: "2026-09-01" },
    ];
    expect(moneyToJson(sumChangeDeltas(changes, "upsell", "2026-08-01", "2026-08-31"))).toBe("500.00");
    expect(moneyToJson(sumChangeDeltas(changes, "downsell", "2026-08-01", "2026-08-31"))).toBe("200.00");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-metrics.test.ts
```

Expected: FAIL — `src/lib/financial/metrics.ts` does not exist.

- [ ] **Step 3: Implement the metrics module**

Create `src/lib/financial/metrics.ts`:

```ts
import type {
  BillingFrequency,
  ChangeType,
} from "./types";
import { addDaysCivil, compareCivil, diffMonths, isWithin } from "./civil-date";
import { Money, div, mul, sum, toDecimal, moneyToJson } from "./money";

const FREQUENCY_MONTHS: Record<BillingFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function monthlyValue(
  officialValue: Money,
  frequency: BillingFrequency
): Money {
  return div(officialValue, toDecimal(FREQUENCY_MONTHS[frequency]));
}

interface ContractForMrr {
  officialValue: Money;
  durationType: string;
  billingFrequency: string | null;
  startDate: string;
  endDate: string | null;
}

export function mrrForContract(contract: ContractForMrr): Money | null {
  if (contract.durationType === "oneTime") return null;
  if (contract.durationType === "openEnded") {
    if (!contract.billingFrequency) return null;
    return monthlyValue(
      contract.officialValue,
      contract.billingFrequency as BillingFrequency
    );
  }
  if (!contract.endDate) return null;
  const months = Math.max(1, diffMonths(contract.startDate, contract.endDate));
  return div(contract.officialValue, toDecimal(months));
}

export function arrForContract(contract: ContractForMrr): Money | null {
  const mrr = mrrForContract(contract);
  return mrr ? mul(mrr, toDecimal(12)) : null;
}

export interface InstallmentLike {
  status: string;
  expectedAmount: Money;
  dueDate: string;
  paidAt: string | null;
}

export function forecastTotal(
  installments: InstallmentLike[],
  from: string,
  to: string
): Money {
  return sum(
    installments
      .filter((i) => i.status !== "cancelled" && isWithin(i.dueDate, from, to))
      .map((i) => i.expectedAmount)
  );
}

export function receivedTotal(
  installments: InstallmentLike[],
  from: string,
  to: string
): Money {
  return sum(
    installments
      .filter(
        (i) =>
          i.status === "paid" &&
          i.paidAt !== null &&
          isWithin(i.paidAt, from, to)
      )
      .map((i) => i.expectedAmount)
  );
}

export function overdueTotal(
  installments: InstallmentLike[],
  today: string
): Money {
  return sum(
    installments
      .filter((i) => i.status === "pending" && compareCivil(i.dueDate, today) < 0)
      .map((i) => i.expectedAmount)
  );
}

export interface MonthlyPoint {
  month: string;
  forecast: string;
  received: string;
}

export function groupMonthly(
  installments: InstallmentLike[],
  from: string,
  to: string
): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  let cursor = `${from.slice(0, 7)}-01`;
  const endKey = to.slice(0, 7);
  let guard = 0;
  while (cursor.slice(0, 7) <= endKey && guard < 60) {
    const next = `${addDaysCivil(cursor, 32).slice(0, 7)}-01`;
    const end = addDaysCivil(next, -1);
    points.push({
      month: cursor.slice(0, 7),
      forecast: moneyToJson(forecastTotal(installments, cursor, end)),
      received: moneyToJson(receivedTotal(installments, cursor, end)),
    });
    cursor = next;
    guard += 1;
  }
  return points;
}

export function isExpiringSoon(
  endDate: string,
  today: string,
  days = 30
): boolean {
  const horizon = addDaysCivil(today, days);
  return compareCivil(endDate, today) >= 0 && compareCivil(endDate, horizon) <= 0;
}

export function activeContractedValue(
  contracts: Array<{
    status: string;
    durationType: string;
    officialValue: Money;
  }>
): Money {
  return sum(
    contracts
      .filter(
        (c) =>
          c.status === "active" &&
          (c.durationType === "fixed" || c.durationType === "oneTime")
      )
      .map((c) => c.officialValue)
  );
}

export function sumChangeDeltas(
  changes: Array<{
    type: string;
    delta: Money;
    effectiveDate: string;
  }>,
  type: ChangeType,
  from: string,
  to: string
): Money {
  return sum(
    changes
      .filter((c) => c.type === type && isWithin(c.effectiveDate, from, to))
      .map((c) => c.delta)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/financial/metrics.ts src/__tests__/financial-metrics.test.ts
git commit -m "feat(financial): add revenue metrics domain"
```

---

