import type { Prisma } from "@prisma/client";
import { prisma, withTenant, withTenantBypass } from "../../../prisma/client";

export class AICreditPackageError extends Error {
  constructor(readonly code: "VALIDATION_ERROR" | "LIMIT_EXCEEDED" | "CONFLICT" | "NOT_FOUND", message: string) {
    super(message);
    this.name = "AICreditPackageError";
  }
}

export function refundableCreditQuantity(input: {
  packageCredits: number;
  packageAmountCents: number;
  refundAmountCents: number;
  unusedCredits: number;
}): number {
  if (input.packageCredits <= 0 || input.packageAmountCents <= 0 || input.refundAmountCents <= 0) return 0;
  const proportional = Math.floor(input.packageCredits * Math.min(input.refundAmountCents, input.packageAmountCents) / input.packageAmountCents);
  return Math.min(input.unusedCredits, proportional);
}

export async function listAICreditPackages(activeOnly = false) {
  return prisma.aiCreditPackage.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: [{ isActive: "desc" }, { priceCents: "asc" }] });
}

export async function createPendingAICreditPurchase(input: {
  tenantId: string;
  purchaserId: string;
  packageId: string;
  stripeCheckoutSessionId: string;
}): Promise<{ id: string; amountCents: number; creditQuantity: number; stripePriceId: string }> {
  return withTenant(input.tenantId, () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE`;
    const pkg = await tx.aiCreditPackage.findUnique({ where: { id: input.packageId } });
    if (!pkg || !pkg.isActive) throw new AICreditPackageError("NOT_FOUND", "Credit package is not available");
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const purchases = await tx.aiCreditPurchase.findMany({ where: { tenantId: input.tenantId, createdAt: { gte: monthStart }, status: { in: ["pending", "paid"] } }, select: { creditQuantity: true } });
    if (pkg.maxPurchasesPerMonth !== null && purchases.length >= pkg.maxPurchasesPerMonth) throw new AICreditPackageError("LIMIT_EXCEEDED", "Monthly package purchase limit reached");
    if (pkg.maxCreditsPerMonth !== null && purchases.reduce((sum, purchase) => sum + purchase.creditQuantity, 0) + pkg.creditQuantity > pkg.maxCreditsPerMonth) throw new AICreditPackageError("LIMIT_EXCEEDED", "Monthly credit purchase limit reached");
    const purchase = await tx.aiCreditPurchase.create({ data: { tenantId: input.tenantId, purchaserId: input.purchaserId, packageId: pkg.id, stripeCheckoutSessionId: input.stripeCheckoutSessionId, amountCents: pkg.priceCents, creditQuantity: pkg.creditQuantity } });
    return { id: purchase.id, amountCents: pkg.priceCents, creditQuantity: pkg.creditQuantity, stripePriceId: pkg.stripePriceId };
  }));
}

export async function confirmAICreditPurchase(input: { checkoutSessionId: string; purchaseId?: string | null; paymentIntentId?: string | null }): Promise<{ granted: boolean; quantity: number }> {
  return withTenantBypass(() => prisma.$transaction(async (tx) => {
    const purchase = input.purchaseId
      ? await tx.aiCreditPurchase.findUnique({ where: { id: input.purchaseId }, include: { package: true } })
      : await tx.aiCreditPurchase.findUnique({ where: { stripeCheckoutSessionId: input.checkoutSessionId }, include: { package: true } });
    if (!purchase) throw new AICreditPackageError("NOT_FOUND", "Credit purchase not found");
    await tx.$queryRaw`SELECT id FROM "ai_credit_purchases" WHERE id = ${purchase.id} FOR UPDATE`;
    const lockedPurchase = await tx.aiCreditPurchase.findUnique({ where: { id: purchase.id }, include: { package: true } });
    if (!lockedPurchase) throw new AICreditPackageError("NOT_FOUND", "Credit purchase not found");
    if (lockedPurchase.status === "paid") return { granted: false, quantity: lockedPurchase.creditQuantity };
    if (lockedPurchase.status !== "pending") throw new AICreditPackageError("CONFLICT", "Credit purchase is not payable");
    await tx.aiCreditPurchase.update({ where: { id: lockedPurchase.id }, data: { status: "paid", paidAt: new Date(), stripePaymentIntentId: input.paymentIntentId ?? null, stripeCheckoutSessionId: input.checkoutSessionId } });
    await tx.aiCreditLedgerEntry.create({ data: { tenantId: lockedPurchase.tenantId, actorId: lockedPurchase.purchaserId, pool: "purchased", kind: "purchased_grant", quantity: lockedPurchase.creditQuantity, operationKey: `purchase-grant:${lockedPurchase.id}`, sourceId: lockedPurchase.id, reason: "Confirmed Stripe payment", metadata: { checkoutSessionId: input.checkoutSessionId } as Prisma.InputJsonValue } });
    return { granted: true, quantity: lockedPurchase.creditQuantity };
  }));
}

export async function failAICreditPurchase(checkoutSessionId: string): Promise<void> {
  await withTenantBypass(() => prisma.aiCreditPurchase.updateMany({ where: { stripeCheckoutSessionId: checkoutSessionId, status: "pending" }, data: { status: "failed" } }));
}

export async function reconcileAICreditRefund(input: { paymentIntentId: string; refundId: string; refundAmountCents: number }): Promise<{ revoked: number; replayed: boolean }> {
  return withTenantBypass(() => prisma.$transaction(async (tx) => {
    const operationKey = `purchase-refund:${input.refundId}`;
    const existing = await tx.aiCreditLedgerEntry.findFirst({ where: { operationKey, pool: "purchased" }, select: { quantity: true } });
    if (existing) return { revoked: Math.abs(existing.quantity), replayed: true };
    const purchase = await tx.aiCreditPurchase.findUnique({ where: { stripePaymentIntentId: input.paymentIntentId } });
    if (!purchase) throw new AICreditPackageError("NOT_FOUND", "Credit purchase not found");
    await tx.$queryRaw`SELECT id FROM "ai_credit_purchases" WHERE id = ${purchase.id} FOR UPDATE`;
    const entries = await tx.aiCreditLedgerEntry.findMany({ where: { tenantId: purchase.tenantId, pool: "purchased" }, orderBy: { createdAt: "asc" }, select: { kind: true, quantity: true, sourceId: true, createdAt: true } });
    const consumed = entries.filter((entry) => entry.kind === "cycle_debit").reduce((sum, entry) => sum + Math.abs(entry.quantity), 0);
    const targetIndex = entries.findIndex((entry) => entry.kind === "purchased_grant" && entry.sourceId === purchase.id);
    const targetGrant = targetIndex >= 0 ? entries[targetIndex].quantity : 0;
    const grantsBeforeTarget = targetIndex >= 0 ? entries.slice(0, targetIndex).filter((entry) => entry.kind === "purchased_grant").reduce((sum, entry) => sum + entry.quantity, 0) : 0;
    const priorRefunds = entries.filter((entry) => entry.kind === "refund" && entry.sourceId === purchase.id).reduce((sum, entry) => sum + Math.abs(entry.quantity), 0);
    const unused = Math.max(0, targetGrant - Math.max(0, consumed - grantsBeforeTarget) - priorRefunds);
    const incrementalRefund = Math.max(0, Math.min(input.refundAmountCents, purchase.amountCents) - purchase.refundedAmountCents);
    const revoked = refundableCreditQuantity({ packageCredits: purchase.creditQuantity, packageAmountCents: purchase.amountCents, refundAmountCents: incrementalRefund, unusedCredits: unused });
    await tx.aiCreditPurchase.update({ where: { id: purchase.id }, data: { refundedAmountCents: { increment: incrementalRefund }, status: input.refundAmountCents >= purchase.amountCents ? "refunded" : purchase.status } });
    if (revoked === 0) return { revoked, replayed: false };
    await tx.aiCreditLedgerEntry.create({ data: { tenantId: purchase.tenantId, actorId: null, pool: "purchased", kind: "refund", quantity: -revoked, operationKey, sourceId: purchase.id, reason: "Stripe payment refund", metadata: { refundId: input.refundId, refundAmountCents: input.refundAmountCents } as Prisma.InputJsonValue } });
    return { revoked, replayed: false };
  }));
}
