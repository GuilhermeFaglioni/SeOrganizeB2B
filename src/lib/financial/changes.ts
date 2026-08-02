import type { ChangeType, InstallmentPlanItem, PaymentMethod } from "./types";
import { isNegative, lt, Money, neg, sum, toCents, toDecimal, fromCents, gt, moneyToJson } from "./money";

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
