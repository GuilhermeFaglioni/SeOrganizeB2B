# Financial Module — Task 2

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 2: Add Money and Civil Date Domain Helpers

**Files:**
- Create: `src/lib/financial/types.ts`
- Create: `src/lib/financial/money.ts`
- Create: `src/lib/financial/civil-date.ts`
- Create: `src/__tests__/financial-money.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `src/__tests__/financial-money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toDecimal,
  add,
  sub,
  mul,
  div,
  sum,
  eq,
  lt,
  isNegative,
  toCents,
  fromCents,
  moneyToJson,
  formatBRL,
} from "../lib/financial/money";
import {
  isCivilDate,
  todayCivilDate,
  addMonthsCivil,
  addDaysCivil,
  monthKey,
  compareCivil,
  isWithin,
  formatCivilDate,
} from "../lib/financial/civil-date";

describe("money helpers", () => {
  it("performs decimal-safe arithmetic", () => {
    const a = toDecimal("10.10");
    const b = toDecimal("0.30");
    expect(add(a, b).toString()).toBe("10.4");
    expect(sub(a, b).toString()).toBe("9.8");
    expect(mul(a, toDecimal(2)).toString()).toBe("20.2");
    expect(div(a, toDecimal(2)).toString()).toBe("5.05");
    expect(sum([a, b, toDecimal("0.60")]).toString()).toBe("11");
  });

  it("never produces floating point error", () => {
    expect(add(toDecimal("0.1"), toDecimal("0.2")).toString()).toBe("0.3");
  });

  it("rounds to cents and formats BRL", () => {
    expect(toCents(toDecimal("12.34"))).toBe(1234);
    expect(fromCents(1234).toString()).toBe("12.34");
    expect(moneyToJson(toDecimal("12.3"))).toBe("12.30");
    expect(formatBRL(toDecimal("1234.5"))).toBe("R$ 1.234,50");
  });

  it("compares with tolerance-free decimal equality", () => {
    expect(eq(toDecimal("1.00"), toDecimal("1"))).toBe(true);
    expect(lt(toDecimal("0.99"), toDecimal("1"))).toBe(true);
    expect(isNegative(toDecimal("-0.01"))).toBe(true);
  });
});

describe("civil date helpers", () => {
  it("validates and compares YYYY-MM-DD strings", () => {
    expect(isCivilDate("2026-08-02")).toBe(true);
    expect(isCivilDate("2026-02-30")).toBe(false);
    expect(isCivilDate("2026-8-02")).toBe(false);
    expect(compareCivil("2026-08-02", "2026-08-03")).toBe(-1);
    expect(isWithin("2026-08-02", "2026-08-01", "2026-08-31")).toBe(true);
    expect(monthKey("2026-08-02")).toBe("2026-08");
  });

  it("adds months and days while clamping to month end", () => {
    expect(addMonthsCivil("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsCivil("2026-08-02", 2)).toBe("2026-10-02");
    expect(addDaysCivil("2026-08-02", 30)).toBe("2026-09-01");
  });

  it("produces a valid today value and UTC-stable formatting", () => {
    expect(isCivilDate(todayCivilDate())).toBe(true);
    expect(formatCivilDate("2026-08-02")).toBe("Aug 2, 2026");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/financial-money.test.ts
```

Expected: FAIL — `../lib/financial/money` and `../lib/financial/civil-date`
do not exist.

- [ ] **Step 3: Create the shared types**

Create `src/lib/financial/types.ts`:

```ts
export const CONTRACT_STATUSES = ["draft", "active", "closed", "cancelled", "suspended"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DURATION_TYPES = ["fixed", "openEnded", "oneTime"] as const;
export type DurationType = (typeof DURATION_TYPES)[number];

export const BILLING_FREQUENCIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const PAYMENT_METHODS = ["pix", "boleto", "bank_transfer", "credit_card", "debit_card", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INSTALLMENT_STATUSES = ["pending", "paid", "cancelled"] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const CHANGE_TYPES = ["upsell", "downsell"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type LifecycleAction = "activate" | "suspend" | "resume" | "close" | "cancel" | "renew";

export interface InstallmentPlanItem {
  expectedAmount: string;
  dueDate: string;
  paymentMethod: PaymentMethod;
}

export interface ContractSummary {
  id: string;
  code: string;
  title: string;
  status: ContractStatus;
  durationType: DurationType;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  billingFrequency: BillingFrequency | null;
  clientId: string;
  ownerId: string | null;
  notes: string | null;
  paymentMethod: string;
  client: { id: string; name: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

- [ ] **Step 4: Create the money helpers**

Create `src/lib/financial/money.ts`:

```ts
import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;

export function toDecimal(value: string | number | Prisma.Decimal): Money {
  return new Prisma.Decimal(value);
}

export function add(a: Money, b: Money): Money {
  return a.plus(b);
}

export function sub(a: Money, b: Money): Money {
  return a.minus(b);
}

export function mul(a: Money, b: Money): Money {
  return a.times(b);
}

export function div(a: Money, b: Money): Money {
  return a.dividedBy(b);
}

export function neg(a: Money): Money {
  return a.negated();
}

export function sum(values: Money[]): Money {
  return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
}

export function eq(a: Money, b: Money): boolean {
  return a.equals(b);
}

export function gt(a: Money, b: Money): boolean {
  return a.greaterThan(b);
}

export function gte(a: Money, b: Money): boolean {
  return a.greaterThanOrEqualTo(b);
}

export function lt(a: Money, b: Money): boolean {
  return a.lessThan(b);
}

export function isNegative(a: Money): boolean {
  return a.isNegative();
}

export function toCents(a: Money): number {
  return a.times(100).toDecimalPlaces(0).toNumber();
}

export function fromCents(cents: number): Money {
  return new Prisma.Decimal(cents).dividedBy(100);
}

export function moneyToJson(a: Money): string {
  return a.toFixed(2);
}

export function formatBRL(value: Money): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value.toNumber());
}
```

- [ ] **Step 5: Create the civil date helpers**

Create `src/lib/financial/civil-date.ts`:

```ts
const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: string): boolean {
  if (!CIVIL_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayCivilDate(): string {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addMonthsCivil(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const result = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), clampedDay)
  );
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addDaysCivil(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function diffMonths(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function compareCivil(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isWithin(date: string, from: string, to: string): boolean {
  return compareCivil(date, from) >= 0 && compareCivil(date, to) <= 0;
}

export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/financial-money.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/financial/types.ts src/lib/financial/money.ts src/lib/financial/civil-date.ts src/__tests__/financial-money.test.ts
git commit -m "feat(financial): add money and civil date helpers"
```

---

