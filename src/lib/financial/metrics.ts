import type {
  BillingFrequency,
  ChangeType,
} from "./types";
import { addDaysCivil, compareCivil, diffMonths, isWithin } from "./civil-date";
import { Money, div, mul, sum, toDecimal } from "./money";

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
  const months = Math.max(1, diffMonths(contract.startDate, contract.endDate) + 1);
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
  forecast: Money;
  received: Money;
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
      forecast: forecastTotal(installments, cursor, end),
      received: receivedTotal(installments, cursor, end),
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
