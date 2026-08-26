import type { Prisma } from "@prisma/client";
import { prisma, withTenant } from "../../../prisma/client";
import { consumeAICreditsInTransaction } from "./credit-ledger";
import type { AIModelCatalogEntry } from "./model-catalog";

export const AI_STUDIO_MANAGED_CYCLE_TTL_MS = 30 * 60 * 1_000;
export const AI_STUDIO_MAX_ALTERATIONS = 5;
export const AI_STUDIO_MAX_REFUNDED_FAILURES = 3;

export type ManagedCycleStatus = "active" | "saved" | "expired" | "exhausted" | "switched";

export class ManagedAICycleLimitError extends Error {
  constructor() {
    super("Managed AI Studio refund limit reached");
    this.name = "ManagedAICycleLimitError";
  }
}

export interface ManagedCycleState {
  id: string;
  tenantId: string;
  actorId: string;
  provider: string;
  model: string;
  catalogEntryId: string;
  modelVersion: number;
  creditCostPerCycle: number;
  debitOperationKey: string;
  alterationCount: number;
  refundedFailureCount: number;
  status: ManagedCycleStatus;
  expiresAt: string;
  lastCandidateHtml: string | null;
  detectedVariables: unknown;
  sessionSummary: unknown;
  switchHistory: unknown;
}

type CycleRecord = {
  id: string;
  tenantId: string;
  actorId: string;
  provider: string;
  model: string;
  catalogEntryId: string;
  modelVersion: number;
  creditCostPerCycle: number;
  debitOperationKey: string;
  alterationCount: number;
  refundedFailureCount: number;
  status: string;
  expiresAt: Date;
  lastCandidateHtml: string | null;
  detectedVariables: unknown;
  sessionSummary: unknown;
  switchHistory: unknown;
};

function toState(cycle: CycleRecord): ManagedCycleState {
  return { ...cycle, status: cycle.status as ManagedCycleStatus, expiresAt: cycle.expiresAt.toISOString() };
}

function cycleSelect() {
  return {
    id: true, tenantId: true, actorId: true, provider: true, model: true,
    catalogEntryId: true, modelVersion: true, creditCostPerCycle: true, debitOperationKey: true,
    alterationCount: true, refundedFailureCount: true, status: true,
    expiresAt: true, lastCandidateHtml: true, detectedVariables: true, sessionSummary: true, switchHistory: true,
  } as const;
}

export async function startOrResumeManagedAICycle(input: {
  tenantId: string;
  actorId: string;
  catalog: AIModelCatalogEntry;
  operationKey: string;
  now?: Date;
}): Promise<{ cycle: ManagedCycleState; resumed: boolean }> {
  const now = input.now ?? new Date();
  return withTenant(input.tenantId, () => prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE`;
    const existing = await transaction.aiStudioManagedCycle.findFirst({
      where: { tenantId: input.tenantId, actorId: input.actorId, status: "active" },
      orderBy: { createdAt: "desc" },
      select: cycleSelect(),
    });
    if (existing && existing.expiresAt > now) {
      if (existing.refundedFailureCount >= AI_STUDIO_MAX_REFUNDED_FAILURES) throw new ManagedAICycleLimitError();
      if (existing.provider !== input.catalog.provider || existing.model !== input.catalog.model) {
        const switchHistory = Array.isArray(existing.switchHistory) ? existing.switchHistory : [];
        const updated = await transaction.aiStudioManagedCycle.update({
          where: { id: existing.id },
          data: {
            provider: input.catalog.provider,
            model: input.catalog.model,
            catalogEntryId: input.catalog.id,
            modelVersion: input.catalog.version,
            inputCostMicros: input.catalog.inputCostMicros,
            outputCostMicros: input.catalog.outputCostMicros,
            imageCostMicros: input.catalog.imageCostMicros,
            creditCostPerCycle: input.catalog.creditCostPerCycle,
            switchHistory: [...switchHistory, {
              fromProvider: existing.provider,
              fromModel: existing.model,
              toProvider: input.catalog.provider,
              toModel: input.catalog.model,
              at: now.toISOString(),
            }] as Prisma.InputJsonValue,
          },
          select: cycleSelect(),
        });
        return { cycle: toState(updated), resumed: true };
      }
      return { cycle: toState(existing), resumed: true };
    }
    if (existing) await transaction.aiStudioManagedCycle.update({ where: { id: existing.id }, data: { status: "expired" } });

    await consumeAICreditsInTransaction(transaction, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      quantity: input.catalog.creditCostPerCycle,
      operationKey: input.operationKey,
      reason: `AI Studio managed cycle ${input.catalog.provider}/${input.catalog.model}`,
    });
    const cycle = await transaction.aiStudioManagedCycle.create({
      data: {
        tenantId: input.tenantId, actorId: input.actorId,
        provider: input.catalog.provider, model: input.catalog.model,
        catalogEntryId: input.catalog.id, modelVersion: input.catalog.version,
        inputCostMicros: input.catalog.inputCostMicros,
        outputCostMicros: input.catalog.outputCostMicros,
        imageCostMicros: input.catalog.imageCostMicros,
        creditCostPerCycle: input.catalog.creditCostPerCycle,
        debitOperationKey: input.operationKey,
        expiresAt: new Date(now.getTime() + AI_STUDIO_MANAGED_CYCLE_TTL_MS),
      },
      select: cycleSelect(),
    });
    return { cycle: toState(cycle), resumed: false };
  }));
}

export async function getActiveManagedAICycle(input: {
  tenantId: string;
  actorId: string;
  now?: Date;
}): Promise<ManagedCycleState | null> {
  const now = input.now ?? new Date();
  return withTenant(input.tenantId, async () => {
    const cycle = await prisma.aiStudioManagedCycle.findFirst({ where: { tenantId: input.tenantId, actorId: input.actorId, status: "active" }, orderBy: { createdAt: "desc" }, select: cycleSelect() });
    if (!cycle) return null;
    if (cycle.expiresAt <= now) {
      await prisma.aiStudioManagedCycle.update({ where: { id: cycle.id }, data: { status: "expired" } });
      return null;
    }
    return toState(cycle);
  });
}

export async function recordManagedAICycleCandidate(input: {
  tenantId: string;
  actorId: string;
  cycleId: string;
  html: string;
  detectedVariables: unknown;
  sessionSummary: unknown;
}): Promise<ManagedCycleState> {
  return withTenant(input.tenantId, async () => {
    const cycle = await prisma.aiStudioManagedCycle.findFirst({ where: { id: input.cycleId, tenantId: input.tenantId, actorId: input.actorId, status: "active" }, select: cycleSelect() });
    if (!cycle) throw new Error("Managed AI Studio cycle is no longer active");
    if (cycle.expiresAt <= new Date()) {
      await prisma.aiStudioManagedCycle.update({ where: { id: cycle.id }, data: { status: "expired" } });
      throw new Error("Managed AI Studio cycle has expired");
    }
    const alterationCount = cycle.alterationCount + (cycle.alterationCount === 0 && !cycle.lastCandidateHtml ? 0 : 1);
    const updated = await prisma.aiStudioManagedCycle.update({
      where: { id: cycle.id },
      data: { alterationCount, lastCandidateHtml: input.html, detectedVariables: input.detectedVariables as Prisma.InputJsonValue, sessionSummary: input.sessionSummary as Prisma.InputJsonValue, status: alterationCount >= AI_STUDIO_MAX_ALTERATIONS ? "exhausted" : "active" },
      select: cycleSelect(),
    });
    return toState(updated);
  });
}

export async function refundManagedAICycleFailure(input: { tenantId: string; actorId: string; cycleId: string; requestId: string }): Promise<ManagedCycleState> {
  return withTenant(input.tenantId, () => prisma.$transaction(async (transaction) => {
    const cycle = await transaction.aiStudioManagedCycle.findFirst({ where: { id: input.cycleId, tenantId: input.tenantId, actorId: input.actorId }, select: cycleSelect() });
    if (!cycle || cycle.status !== "active") return cycle ? toState(cycle) : (() => { throw new Error("Managed AI Studio cycle is no longer active"); })();
    if (cycle.refundedFailureCount >= AI_STUDIO_MAX_REFUNDED_FAILURES) throw new ManagedAICycleLimitError();
    const debits = await transaction.aiCreditLedgerEntry.findMany({ where: { tenantId: input.tenantId, operationKey: cycle.debitOperationKey, kind: "cycle_debit" }, select: { pool: true, quantity: true } });
    const refundedForRequest = await transaction.aiCreditLedgerEntry.findMany({ where: { tenantId: input.tenantId, operationKey: { startsWith: `ai-studio-refund:${input.requestId}:` }, kind: "refund" }, select: { id: true } });
    if (refundedForRequest.length > 0) return toState(cycle);
    for (const debit of debits) {
      const priorRefunds = await transaction.aiCreditLedgerEntry.findMany({ where: { tenantId: input.tenantId, sourceId: cycle.id, pool: debit.pool, kind: "refund" }, select: { quantity: true } });
      const remaining = Math.max(0, Math.abs(debit.quantity) - priorRefunds.reduce((sum, entry) => sum + Math.abs(entry.quantity), 0));
      if (remaining === 0) continue;
      await transaction.aiCreditLedgerEntry.create({ data: { tenantId: input.tenantId, actorId: input.actorId, pool: debit.pool, kind: "refund", quantity: remaining, operationKey: `ai-studio-refund:${input.requestId}:${debit.pool}`, sourceId: cycle.id, reason: "Provider failure without usable response", metadata: { cycleId: cycle.id, requestId: input.requestId, debitOperationKey: cycle.debitOperationKey } } });
    }
    const refundedFailureCount = cycle.refundedFailureCount + 1;
    const updated = await transaction.aiStudioManagedCycle.update({ where: { id: cycle.id }, data: { refundedFailureCount: { increment: 1 }, status: refundedFailureCount >= AI_STUDIO_MAX_REFUNDED_FAILURES ? "exhausted" : "active" }, select: cycleSelect() });
    return toState(updated);
  }));
}

export async function closeManagedAICycle(input: { tenantId: string; actorId: string; cycleId?: string | null; reason: "saved" | "switched" }): Promise<void> {
  if (!input.cycleId && input.reason === "saved") return;
  await withTenant(input.tenantId, () => prisma.aiStudioManagedCycle.updateMany({
    where: {
      ...(input.cycleId ? { id: input.cycleId } : {}),
      tenantId: input.tenantId,
      actorId: input.actorId,
      status: "active",
    },
    data: { status: input.reason },
  }));
}
