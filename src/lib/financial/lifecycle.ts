import type {
  ContractStatus,
  InstallmentPlanItem,
  LifecycleAction,
} from "./types";
import { compareCivil } from "./civil-date";
import { Money, toDecimal } from "./money";
import { validateFinitePlan } from "./installments";

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
  } else {
    if (contract.officialValue.isZero() || contract.officialValue.isNegative()) {
      errors.push("A recurring contract value is required");
    }
    if (plan.length === 0) {
      errors.push("An installment plan is required to activate");
    } else if (plan.some((item) => toDecimal(item.expectedAmount).lte(0))) {
      errors.push("Each recurring cycle must have a positive amount");
    }
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
