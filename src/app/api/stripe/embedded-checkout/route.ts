import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { isStripePriceId } from "@/lib/stripe-price-id";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

function clientSecretOf(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;

  // Pinned API version (2024-12-18.acacia) expands the full PaymentIntent here;
  // newer SDK typings model `payment_intent` as a string id, hence the narrow cast.
  const paymentIntent = (invoice as Stripe.Invoice & {
    payment_intent?: { client_secret?: string | null } | string | null;
  }).payment_intent;

  if (
    paymentIntent &&
    typeof paymentIntent === "object" &&
    typeof paymentIntent.client_secret === "string"
  ) {
    return paymentIntent.client_secret;
  }

  return null;
}

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
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "A valid priceId is required" },
      },
      { status: 400 }
    );
  }

  if (!isStripePriceId(priceId)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "priceId must be a Stripe Price ID (price_…), not a Product ID (prod_…)",
        },
      },
      { status: 400 }
    );
  }

  try {
    const plan = await prisma.plan.findFirst({
      where: { stripePriceId: priceId, isActive: true, isInternal: false },
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
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Workspace not found" },
        },
        { status: 400 }
      );
    }

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { workspaceId: workspace.id },
      });
      customerId = customer.id;
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { workspaceId: workspace.id, planId: plan.id },
      expand: ["latest_invoice.payment_intent"],
    });

    const clientSecret = clientSecretOf(subscription);
    if (!clientSecret) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "STRIPE_CONFIGURATION_ERROR",
            message: "No payment intent returned for the subscription",
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: { clientSecret, subscriptionId: subscription.id },
      error: null,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      console.error(
        `[stripe-embedded-checkout] Stripe ${error.type} (${error.code}) requestId=${error.requestId}: ${error.message}`
      );
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "STRIPE_ERROR",
            message: error.message || "Stripe rejected the request",
          },
        },
        { status: error.statusCode ?? 502 }
      );
    }

    console.error("[stripe-embedded-checkout] failed to create subscription", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
