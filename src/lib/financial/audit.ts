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
