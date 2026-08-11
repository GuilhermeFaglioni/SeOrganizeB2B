import { Prisma } from "@prisma/client";
import { prisma, requireTenantId } from "../../../prisma/client";
import { addMonthsCivil, compareCivil, todayCivilDate } from "./civil-date";
import { FinancialConflictError, FinancialValidationError } from "./lifecycle";
import { recordFinancialAudit } from "./audit";
import { lt, neg, sub, sum, toDecimal } from "./money";

export function refundableValue(
  installment: { expectedAmount: Prisma.Decimal },
  refunds: Array<{ expectedAmount: Prisma.Decimal }>
): Prisma.Decimal {
  const refunded = sum(refunds.map((r) => r.expectedAmount));
  return sub(installment.expectedAmount, refunded.negated());
}

export async function recordPayment(
  installmentId: string,
  paidAt: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be marked as paid"
      );
    }
    const updated = await tx.installment.update({
      where: { id: installmentId },
      data: { status: "paid", paidAt },
    });
    await recordFinancialAudit(tx, {
      contractId: installment.contractId,
      actorId,
      field: "installment.payment",
      beforeValue: {
        status: installment.status,
        paidAt: installment.paidAt ? String(installment.paidAt) : null,
      },
      afterValue: { status: "paid", paidAt },
    });
    return updated;
  });
}

export async function cancelInstallment(
  installmentId: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "pending") {
      throw new FinancialConflictError(
        "Only pending installments can be cancelled"
      );
    }
    const updated = await tx.installment.update({
      where: { id: installmentId },
      data: { status: "cancelled" },
    });
    await recordFinancialAudit(tx, {
      contractId: installment.contractId,
      actorId,
      field: "installment.cancel",
      beforeValue: {
        status: installment.status,
        paidAt: installment.paidAt ? String(installment.paidAt) : null,
      },
      afterValue: { status: "cancelled", paidAt: null },
    });
    return updated;
  });
}

export async function refundInstallment(
  installmentId: string,
  refundAmount: string,
  refundDate: string,
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: installmentId },
      include: { refunds: { select: { expectedAmount: true } } },
    });
    if (!installment) throw new FinancialValidationError("Installment not found");
    if (installment.status !== "paid") {
      throw new FinancialConflictError(
        "Refunds must link to a paid installment"
      );
    }
    const requested = toDecimal(refundAmount);
    const refundable = refundableValue(installment, installment.refunds);
    if (lt(requested, toDecimal(0))) {
      throw new FinancialValidationError("Refund amount must be positive");
    }
    if (lt(refundable, requested)) {
      throw new FinancialValidationError(
        "Refund exceeds the refundable value of the installment"
      );
    }
    const refund = await tx.installment.create({
      data: {
        contractId: installment.contractId,
        expectedAmount: neg(requested),
        dueDate: installment.dueDate,
        paymentMethod: installment.paymentMethod,
        status: "paid",
        paidAt: refundDate,
        refundOfId: installmentId,
        cycleKey: null,
        tenantId: requireTenantId("financial.installments"),
      },
    });
    await recordFinancialAudit(tx, {
      contractId: installment.contractId,
      actorId,
      field: "installment.refund",
      beforeValue: {
        refundable: refundable.toFixed(2),
      },
      afterValue: {
        refundId: refund.id,
        amount: requested.toFixed(2),
        refundDate,
      },
    });
    return refund;
  });
}

export async function extendRecurringHorizons(
  tx: Prisma.TransactionClient
): Promise<number> {
  const today = todayCivilDate();
  const targetDate = addMonthsCivil(today, 12);
  const contracts = await tx.contract.findMany({
    where: { status: "active", durationType: "openEnded" },
    select: {
      id: true,
      startDate: true,
      officialValue: true,
      paymentMethod: true,
      billingFrequency: true,
    },
  });
  let created = 0;
  for (const contract of contracts) {
    const existing = await tx.installment.findMany({
      where: { contractId: contract.id },
      select: { cycleKey: true },
    });
    const existingKeys = new Set(
      existing.map((i) => i.cycleKey).filter((k): k is string => Boolean(k))
    );
    const step = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
      (contract.billingFrequency ?? "monthly") as "monthly" | "quarterly" | "semiannual" | "annual"
    ];
    let index = 0;
    while (true) {
      const dueDate = addMonthsCivil(contract.startDate ?? "", index * step);
      if (compareCivil(dueDate, targetDate) > 0) break;
      if (compareCivil(dueDate, today) >= 0) {
        const cycleKey = dueDate.slice(0, 7);
        if (!existingKeys.has(cycleKey)) {
          await tx.installment.create({
            data: {
              contractId: contract.id,
              expectedAmount: contract.officialValue ?? toDecimal(0),
              dueDate,
              paymentMethod: contract.paymentMethod,
              status: "pending",
              cycleKey,
              tenantId: requireTenantId("financial.installments"),
            },
          });
          created += 1;
        }
      }
      index += 1;
    }
  }
  return created;
}
