import type { Prisma } from "@prisma/client";
import { prisma, withTenant } from "../../../prisma/client";
import { assertMemberCreditLimit, AIMemberCreditLimitError } from "./member-credit-limits";

export const AI_CREDIT_POOLS = ["promotional", "subscription", "purchased"] as const;
export type AICreditPool = (typeof AI_CREDIT_POOLS)[number];

const CONSUMPTION_ORDER: readonly AICreditPool[] = [
  "promotional",
  "subscription",
  "purchased",
];

export type AICreditLedgerKind =
  | "subscription_grant"
  | "purchased_grant"
  | "promotional_grant"
  | "cycle_debit"
  | "expiration"
  | "refund"
  | "adjustment";

export interface CreditPoolBalance {
  pool: AICreditPool;
  available: number;
}

export interface CreditAllocation {
  pool: AICreditPool;
  quantity: number;
}

export interface AICreditBalance {
  promotional: number;
  subscription: number;
  purchased: number;
  total: number;
}

export interface AICreditLedgerHistoryEntry {
  id: string;
  pool: AICreditPool;
  kind: string;
  quantity: number;
  operationKey: string;
  sourceId: string | null;
  billingPeriod: string | null;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export class AICreditLedgerError extends Error {
  readonly code: "VALIDATION_ERROR" | "INSUFFICIENT_CREDITS" | "CONFLICT" | "LIMIT_EXCEEDED";

  constructor(
    code: "VALIDATION_ERROR" | "INSUFFICIENT_CREDITS" | "CONFLICT" | "LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "AICreditLedgerError";
    this.code = code;
  }
}

function isCreditPool(value: string): value is AICreditPool {
  return (AI_CREDIT_POOLS as readonly string[]).includes(value);
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new AICreditLedgerError(
      "VALIDATION_ERROR",
      "Credit quantity must be positive",
    );
  }
}

export function allocateCreditPools(
  balances: readonly CreditPoolBalance[],
  quantity: number,
): CreditAllocation[] {
  assertPositiveQuantity(quantity);

  const availableByPool = new Map(
    balances.map((balance) => [balance.pool, Math.max(0, balance.available)]),
  );
  const totalAvailable = CONSUMPTION_ORDER.reduce(
    (total, pool) => total + (availableByPool.get(pool) ?? 0),
    0,
  );
  if (totalAvailable < quantity) {
    throw new AICreditLedgerError(
      "INSUFFICIENT_CREDITS",
      "Insufficient AI Studio credits",
    );
  }

  let remaining = quantity;
  const allocations: CreditAllocation[] = [];
  for (const pool of CONSUMPTION_ORDER) {
    if (remaining === 0) break;
    const amount = Math.min(remaining, availableByPool.get(pool) ?? 0);
    if (amount === 0) continue;
    allocations.push({ pool, quantity: amount });
    remaining -= amount;
  }
  return allocations;
}

function normalizePool(pool: string): AICreditPool {
  if (!isCreditPool(pool)) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Unknown credit pool");
  }
  return pool;
}

function toBalance(entries: Array<{ pool: string; quantity: number; expiresAt: Date | null }>, now: Date): AICreditBalance {
  const balance: AICreditBalance = {
    promotional: 0,
    subscription: 0,
    purchased: 0,
    total: 0,
  };
  for (const entry of entries) {
    if (entry.expiresAt && entry.expiresAt <= now) continue;
    if (!isCreditPool(entry.pool)) continue;
    balance[entry.pool] += entry.quantity;
  }
  if (balance.promotional < 0 || balance.subscription < 0 || balance.purchased < 0) {
    throw new AICreditLedgerError("CONFLICT", "Credit ledger balance is invalid");
  }
  balance.total = balance.promotional + balance.subscription + balance.purchased;
  return balance;
}

export async function getAICreditBalance(
  tenantId: string,
  now = new Date(),
): Promise<AICreditBalance> {
  const entries = await withTenant(tenantId, () =>
    prisma.aiCreditLedgerEntry.findMany({
      where: { tenantId },
      select: { pool: true, quantity: true, expiresAt: true },
    }),
  );
  return toBalance(entries, now);
}

export async function getAICreditLedgerHistory(
  tenantId: string,
  limit = 100,
): Promise<AICreditLedgerHistoryEntry[]> {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const entries = await withTenant(tenantId, () =>
    prisma.aiCreditLedgerEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      select: {
        id: true,
        pool: true,
        kind: true,
        quantity: true,
        operationKey: true,
        sourceId: true,
        billingPeriod: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  );
  return entries
    .filter((entry): entry is typeof entry & { pool: AICreditPool } => isCreditPool(entry.pool))
    .map((entry) => ({
      id: entry.id,
      pool: entry.pool,
      kind: entry.kind,
      quantity: entry.quantity,
      operationKey: entry.operationKey,
      sourceId: entry.sourceId,
      billingPeriod: entry.billingPeriod,
      reason: entry.reason,
      expiresAt: entry.expiresAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
    }));
}

export async function appendAICreditLedgerEntry(input: {
  tenantId: string;
  actorId?: string | null;
  pool: AICreditPool;
  kind: AICreditLedgerKind;
  quantity: number;
  operationKey: string;
  sourceId?: string | null;
  billingPeriod?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date | null;
}): Promise<void> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity === 0) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Credit quantity must be non-zero");
  }
  if (!input.operationKey.trim()) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Operation key is required");
  }
  if (input.kind === "cycle_debit" || input.kind === "expiration") {
    if (input.quantity >= 0) {
      throw new AICreditLedgerError("VALIDATION_ERROR", "Debit entries must be negative");
    }
  } else if (input.kind === "subscription_grant" || input.kind === "purchased_grant" || input.kind === "promotional_grant") {
    if (input.quantity <= 0) {
      throw new AICreditLedgerError("VALIDATION_ERROR", "Grant entries must be positive");
    }
  } else if (input.quantity === 0) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Credit quantity must be non-zero");
  }

  await withTenant(input.tenantId, () =>
    prisma.aiCreditLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        pool: normalizePool(input.pool),
        kind: input.kind,
        quantity: input.quantity,
        operationKey: input.operationKey,
        sourceId: input.sourceId ?? null,
        billingPeriod: input.billingPeriod ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
        expiresAt: input.expiresAt ?? null,
      },
    }),
  );
}

export async function grantSubscriptionCredits(input: {
  tenantId: string;
  invoiceId: string;
  billingPeriod?: string | null;
}): Promise<{ granted: boolean; quantity: number }> {
  if (!input.invoiceId.trim()) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Invoice id is required");
  }

  return withTenant(input.tenantId, () =>
    prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE
      `;

      const operationKey = `subscription-grant:${input.invoiceId}`;
      const existing = await transaction.aiCreditLedgerEntry.findFirst({
        where: { tenantId: input.tenantId, pool: "subscription", operationKey },
        select: { quantity: true },
      });
      if (existing) return { granted: false, quantity: existing.quantity };

      const workspace = await transaction.workspace.findUnique({
        where: { id: input.tenantId },
        select: { plan: { select: { monthlyAiStudioCredits: true, allowedModules: true } } },
      });
      const quantity = workspace?.plan?.monthlyAiStudioCredits ?? 0;
      const modules = (workspace?.plan?.allowedModules as string[] | null) ?? [];
      if (quantity <= 0 || !modules.includes("ai_studio")) {
        return { granted: false, quantity: 0 };
      }

      const current = await transaction.aiCreditLedgerEntry.findMany({
        where: {
          tenantId: input.tenantId,
          pool: "subscription",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { quantity: true },
      });
      const remaining = current.reduce((total, entry) => total + entry.quantity, 0);
      if (remaining > 0) {
        await transaction.aiCreditLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            pool: "subscription",
            kind: "expiration",
            quantity: -remaining,
            operationKey: `subscription-expiration:${input.invoiceId}`,
            sourceId: input.invoiceId,
            billingPeriod: input.billingPeriod ?? null,
            reason: "Replaced by a confirmed paid subscription cycle",
            metadata: { replacedByInvoiceId: input.invoiceId },
          },
        });
      }
      await transaction.aiCreditLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          pool: "subscription",
          kind: "subscription_grant",
          quantity,
          operationKey,
          sourceId: input.invoiceId,
          billingPeriod: input.billingPeriod ?? null,
          reason: "Confirmed Stripe invoice payment",
          metadata: { invoiceId: input.invoiceId },
        },
      });
      return { granted: true, quantity };
    }),
  );
}

export async function consumeAICredits(input: {
  tenantId: string;
  actorId: string;
  quantity: number;
  operationKey: string;
  reason?: string;
}): Promise<{ allocations: CreditAllocation[]; replayed: boolean }> {
  assertPositiveQuantity(input.quantity);
  if (!input.operationKey.trim()) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Operation key is required");
  }

  return withTenant(input.tenantId, () =>
    prisma.$transaction(async (transaction) => {
      return consumeAICreditsInTransaction(transaction, input);
    }),
  );
}

export async function consumeAICreditsInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    quantity: number;
    operationKey: string;
    reason?: string;
  },
): Promise<{ allocations: CreditAllocation[]; replayed: boolean }> {
  assertPositiveQuantity(input.quantity);
  if (!input.operationKey.trim()) {
    throw new AICreditLedgerError("VALIDATION_ERROR", "Operation key is required");
  }

  // The idempotency lookup must be protected by the same workspace lock as balance calculation.
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE
  `;
  const existing = await transaction.aiCreditLedgerEntry.findMany({
        where: { tenantId: input.tenantId, operationKey: input.operationKey },
        select: { pool: true, quantity: true, kind: true, actorId: true, metadata: true },
      });
      if (existing.length > 0) {
        if (existing.some((entry) => entry.kind !== "cycle_debit")) {
          throw new AICreditLedgerError("CONFLICT", "Credit operation key was already used");
        }
        const requestedQuantity = existing.reduce((total, entry) => total + Math.abs(entry.quantity), 0);
        if (
          requestedQuantity !== input.quantity ||
          existing.some((entry) => entry.actorId !== input.actorId)
        ) {
          throw new AICreditLedgerError("CONFLICT", "Credit operation key was already used");
        }
        return {
          allocations: existing
            .filter((entry): entry is typeof entry & { pool: AICreditPool } => isCreditPool(entry.pool))
            .map((entry) => ({ pool: entry.pool, quantity: Math.abs(entry.quantity) })),
          replayed: true,
        };
      }

  const now = new Date();
      const entries = await transaction.aiCreditLedgerEntry.findMany({
        where: {
          tenantId: input.tenantId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { pool: true, quantity: true, expiresAt: true },
      });
      const balances = AI_CREDIT_POOLS.map((pool) => ({
        pool,
        available: entries
          .filter((entry) => entry.pool === pool)
          .reduce((total, entry) => total + entry.quantity, 0),
      }));
  const allocations = allocateCreditPools(balances, input.quantity);
  try {
    await assertMemberCreditLimit(transaction, { tenantId: input.tenantId, profileId: input.actorId, quantity: input.quantity, now });
  } catch (error) {
    if (error instanceof AIMemberCreditLimitError) throw new AICreditLedgerError("LIMIT_EXCEEDED", error.message);
    throw error;
  }
  for (const allocation of allocations) {
    await transaction.aiCreditLedgerEntry.create({
          data: {
            tenantId: input.tenantId,
            actorId: input.actorId,
            pool: allocation.pool,
            kind: "cycle_debit",
            quantity: -allocation.quantity,
            operationKey: input.operationKey,
            reason: input.reason ?? null,
            metadata: { requestedQuantity: input.quantity, debitOperationKey: input.operationKey },
          },
    });
  }
  return { allocations, replayed: false };
}

export type ManualAICreditOperation = "grant" | "revoke" | "adjustment";

export class AICreditAdminError extends Error {
  readonly code: "VALIDATION_ERROR" | "INSUFFICIENT_CREDITS" | "NOT_FOUND";

  constructor(
    code: "VALIDATION_ERROR" | "INSUFFICIENT_CREDITS" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AICreditAdminError";
    this.code = code;
  }
}

function assertReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) {
    throw new AICreditAdminError("VALIDATION_ERROR", "A reason is required");
  }
  return normalized;
}

/**
 * Applies a platform-admin correction as a new ledger row. Existing rows are
 * deliberately never updated or deleted, so the actor and reason remain
 * auditable for the lifetime of the ledger.
 */
export async function applyManualAICreditOperation(input: {
  tenantId: string;
  actorId: string;
  operation: ManualAICreditOperation;
  pool?: AICreditPool;
  quantity: number;
  reason: string;
  campaign?: string;
  expiresAt?: Date | null;
  operationKey?: string;
}): Promise<{ id: string; pool: AICreditPool; quantity: number }> {
  const reason = assertReason(input.reason);
  if (!Number.isSafeInteger(input.quantity) || input.quantity === 0) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Credit quantity must be a non-zero integer");
  }
  const pool = input.pool ?? "promotional";
  if (!isCreditPool(pool)) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Unknown credit pool");
  }
  if (input.operation === "grant" && pool !== "promotional") {
    throw new AICreditAdminError("VALIDATION_ERROR", "Manual grants must use the promotional pool");
  }
  if (input.operation === "grant" && input.quantity < 0) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Grant quantity must be positive");
  }
  if (input.operation === "revoke" && input.quantity < 0) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Revoke quantity must be positive");
  }
  if (input.operation === "grant" && !input.campaign?.trim()) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Campaign is required for promotional grants");
  }
  if (input.expiresAt && input.expiresAt <= new Date()) {
    throw new AICreditAdminError("VALIDATION_ERROR", "Expiration must be in the future");
  }

  const quantity = input.operation === "revoke" ? -Math.abs(input.quantity) : input.quantity;
  const kind = input.operation === "grant" ? "promotional_grant" : "adjustment";
  const operationKey = input.operationKey?.trim() || `admin-credit:${crypto.randomUUID()}`;

  return withTenant(input.tenantId, () =>
    prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.findUnique({
        where: { id: input.tenantId },
        select: { id: true },
      });
      if (!workspace) throw new AICreditAdminError("NOT_FOUND", "Tenant not found");

      await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE
      `;
      if (quantity < 0) {
        const entries = await transaction.aiCreditLedgerEntry.findMany({
          where: {
            tenantId: input.tenantId,
            pool,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { quantity: true },
        });
        const available = entries.reduce((sum, entry) => sum + entry.quantity, 0);
        if (available + quantity < 0) {
          throw new AICreditAdminError("INSUFFICIENT_CREDITS", "Cannot revoke more credits than are available");
        }
      }

      const entry = await transaction.aiCreditLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          actorId: input.actorId,
          pool,
          kind,
          quantity,
          operationKey,
          reason,
          expiresAt: input.expiresAt ?? null,
          metadata: input.operation === "grant"
            ? { campaign: input.campaign!.trim(), source: "platform_admin" }
            : { source: "platform_admin", operation: input.operation },
        },
        select: { id: true, pool: true, quantity: true },
      });
      return { id: entry.id, pool, quantity: entry.quantity };
    }),
  );
}
