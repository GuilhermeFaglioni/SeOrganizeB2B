import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getUser } from "@/lib/supabase/server";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { tenantId: true },
  });
  if (!profile) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Profile not found" } }, { status: 404 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: profile.tenantId },
    select: { stripeCustomerId: true },
  });
  if (!workspace?.stripeCustomerId) {
    return NextResponse.json(
      { data: null, error: { code: "STRIPE_CUSTOMER_MISSING", message: "Workspace has no Stripe customer" } },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${origin}/app`,
  });

  return NextResponse.json({ data: { url: session.url }, error: null });
}
