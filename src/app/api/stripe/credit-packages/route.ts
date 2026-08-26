import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getEffectivePermissions, hasPermission } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { stripe } from "@/lib/stripe";
import { prisma, withTenant } from "../../../../../prisma/client";
import { createPendingAICreditPurchase, listAICreditPackages, AICreditPackageError } from "@/lib/ai/credit-packages";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: await listAICreditPackages(true), error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 });
  const ctx = await getTenantContext(user.id);
  const effective = await getEffectivePermissions(user.id);
  if (!ctx.tenantId || !hasPermission(effective, "billing.ai_credits.purchase")) return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 });
  const body = await request.json().catch(() => null) as { packageId?: unknown } | null;
  if (typeof body?.packageId !== "string" || !body.packageId.trim()) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "packageId is required" } }, { status: 400 });
  try {
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { tenantId: true, tenant: { select: { id: true, stripeCustomerId: true } } } });
    if (!profile?.tenant) return NextResponse.json({ data: null, error: { code: "NOT_FOUND" } }, { status: 404 });
    let customerId = profile.tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { workspaceId: profile.tenantId } });
      customerId = customer.id;
      await prisma.workspace.update({ where: { id: profile.tenantId }, data: { stripeCustomerId: customerId } });
    }
    const checkoutId = `pending_${crypto.randomUUID()}`;
    const pending = await createPendingAICreditPurchase({ tenantId: profile.tenantId, purchaserId: user.id, packageId: body.packageId, stripeCheckoutSessionId: checkoutId });
    const session = await stripe.checkout.sessions.create({ mode: "payment", customer: customerId, line_items: [{ price: pending.stripePriceId, quantity: 1 }], success_url: `${request.nextUrl.origin}/app/ai-studio?purchase=success`, cancel_url: `${request.nextUrl.origin}/app/ai-studio?purchase=cancelled`, metadata: { workspaceId: profile.tenantId, purchaseId: pending.id }, payment_intent_data: { metadata: { purchaseId: pending.id, workspaceId: profile.tenantId } } });
     await withTenant(profile.tenantId, () => prisma.aiCreditPurchase.update({ where: { id: pending.id }, data: { stripeCheckoutSessionId: session.id } }));
    return NextResponse.json({ data: { url: session.url }, error: null });
  } catch (error) {
    if (error instanceof AICreditPackageError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
    console.error("[stripe-credit-packages] checkout failed", error);
    return NextResponse.json({ data: null, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
