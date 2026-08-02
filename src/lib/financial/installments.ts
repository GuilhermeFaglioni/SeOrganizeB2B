import type {
  BillingFrequency,
  DurationType,
  InstallmentPlanItem,
  PaymentMethod,
} from "./types";
import { addMonthsCivil, diffMonths } from "./civil-date";
import {
  Money,
  fromCents,
  moneyToJson,
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
