import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  let priceId: string;
  try {
    const body = await request.json();
    priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  } catch {
    priceId = "";
  }

  if (!priceId) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A valid priceId is required" } },
      { status: 400 }
    );
  }

  try {
    const plan = await prisma.plan.findFirst({
      where: { stripePriceId: priceId, isActive: true },
    });
    if (!plan) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid plan" } },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      include: { tenant: true },
    });
    const workspace = profile?.tenant;
    if (!workspace) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Workspace not found" } },
        { status: 400 }
      );
    }

    if (!workspace.stripeCustomerId) {
      return NextResponse.json(
        { data: null, error: { code: "STRIPE_CUSTOMER_MISSING", message: "Workspace has no Stripe customer" } },
        { status: 400 }
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: workspace.stripeCustomerId,
      limit: 1,
    });
    const subscription = subscriptions.data[0];
    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { code: "STRIPE_SUBSCRIPTION_MISSING", message: "Workspace has no active subscription" } },
        { status: 400 }
      );
    }

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: subscription.items.data[0].id, price: priceId }],
    });

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { planId: plan.id },
    });

    return NextResponse.json({ data: { url: `${request.nextUrl.origin}/app` }, error: null });
  } catch (error) {
    console.error("[stripe-upgrade] failed to upgrade subscription", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
