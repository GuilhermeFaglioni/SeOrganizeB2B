import type { Prisma } from "@prisma/client";
import { prisma, withTenant } from "../../../prisma/client";

export class AIMemberCreditLimitError extends Error {
  readonly code = "VALIDATION_ERROR";
}

function periodBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

export async function listMemberCreditLimits(tenantId: string) {
  // Keeps the team endpoint readable while older generated clients roll forward.
  if (!prisma.aiMemberCreditLimit) return [];
  return withTenant(tenantId, () => prisma.aiMemberCreditLimit.findMany({ where: { tenantId }, select: { profileId: true, monthlyLimit: true } }));
}

export async function setMemberCreditLimit(input: { tenantId: string; profileId: string; monthlyLimit: number | null }) {
  if (input.monthlyLimit !== null && (!Number.isSafeInteger(input.monthlyLimit) || input.monthlyLimit < 0)) {
    throw new AIMemberCreditLimitError("Monthly limit must be a non-negative integer");
  }
  return withTenant(input.tenantId, async () => {
    const profile = await prisma.profile.findFirst({ where: { id: input.profileId, tenantId: input.tenantId, removedAt: null }, select: { id: true } });
    if (!profile) throw new AIMemberCreditLimitError("User not found");
    if (input.monthlyLimit === null) {
      await prisma.aiMemberCreditLimit.deleteMany({ where: { tenantId: input.tenantId, profileId: input.profileId } });
      return null;
    }
    return prisma.aiMemberCreditLimit.upsert({ where: { profileId: input.profileId }, update: { monthlyLimit: input.monthlyLimit }, create: { tenantId: input.tenantId, profileId: input.profileId, monthlyLimit: input.monthlyLimit }, select: { profileId: true, monthlyLimit: true } });
  });
}

export async function assertMemberCreditLimit(transaction: Prisma.TransactionClient, input: { tenantId: string; profileId: string; quantity: number; now: Date }) {
  const limit = await transaction.aiMemberCreditLimit.findFirst({ where: { tenantId: input.tenantId, profileId: input.profileId }, select: { monthlyLimit: true } });
  if (!limit) return;
  const { start, end } = periodBounds(input.now);
  const debits = await transaction.aiCreditLedgerEntry.findMany({ where: { tenantId: input.tenantId, actorId: input.profileId, kind: "cycle_debit", createdAt: { gte: start, lt: end } }, select: { quantity: true, metadata: true } });
  const refunds = await transaction.aiCreditLedgerEntry.findMany({ where: { tenantId: input.tenantId, kind: "refund", createdAt: { gte: start, lt: end } }, select: { quantity: true, metadata: true } });
  const refunded = new Map<string, number>();
  for (const entry of refunds) if (entry.metadata && typeof entry.metadata === "object" && "debitOperationKey" in entry.metadata) refunded.set(String(entry.metadata.debitOperationKey), (refunded.get(String(entry.metadata.debitOperationKey)) ?? 0) + Math.abs(entry.quantity));
  const used = debits.reduce((total, entry) => { const key = entry.metadata && typeof entry.metadata === "object" && "debitOperationKey" in entry.metadata ? String(entry.metadata.debitOperationKey) : ""; return total + Math.max(0, Math.abs(entry.quantity) - (refunded.get(key) ?? 0)); }, 0);
  if (used + input.quantity > limit.monthlyLimit) throw new AIMemberCreditLimitError("Monthly AI credit limit reached");
}

export async function getMemberCreditLimitUsage(tenantId: string, profileId: string, now = new Date()) {
  const { start, end } = periodBounds(now);
  return withTenant(tenantId, async () => {
    const limit = await prisma.aiMemberCreditLimit.findFirst({ where: { tenantId, profileId }, select: { monthlyLimit: true } });
    const entries = await prisma.aiCreditLedgerEntry.findMany({ where: { tenantId, actorId: profileId, kind: "cycle_debit", createdAt: { gte: start, lt: end } }, select: { quantity: true, metadata: true } });
    const refunds = await prisma.aiCreditLedgerEntry.findMany({ where: { tenantId, kind: "refund", createdAt: { gte: start, lt: end } }, select: { quantity: true, metadata: true } });
    const refunded = new Map<string, number>();
    for (const entry of refunds) if (entry.metadata && typeof entry.metadata === "object" && "debitOperationKey" in entry.metadata) refunded.set(String(entry.metadata.debitOperationKey), (refunded.get(String(entry.metadata.debitOperationKey)) ?? 0) + Math.abs(entry.quantity));
    const used = entries.reduce((total, entry) => { const key = entry.metadata && typeof entry.metadata === "object" && "debitOperationKey" in entry.metadata ? String(entry.metadata.debitOperationKey) : ""; return total + Math.max(0, Math.abs(entry.quantity) - (refunded.get(key) ?? 0)); }, 0);
    return { limit: limit?.monthlyLimit ?? null, used, remaining: limit ? Math.max(0, limit.monthlyLimit - used) : null };
  });
}
