import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

    const price = await stripe.prices.retrieve(priceId);

    if (!price.active || price.type !== "recurring") {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid price" } },
        { status: 400 }
      );
    }

    const customer = await stripe.customers.create({
      metadata: { source: "test-landing", planId: plan.id },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      expand: ["latest_invoice.payment_intent"],
    });

    const latestInvoice = subscription.latest_invoice;
    if (
      latestInvoice &&
      typeof latestInvoice === "object" &&
      "payment_intent" in latestInvoice &&
      latestInvoice.payment_intent &&
      typeof latestInvoice.payment_intent === "object" &&
      "client_secret" in latestInvoice.payment_intent
    ) {
      return NextResponse.json({
        data: {
          clientSecret: latestInvoice.payment_intent.client_secret as string,
          subscriptionId: subscription.id,
        },
        error: null,
      });
    }

    throw new Error("No payment intent returned from subscription");
  } catch (error) {
    console.error("[stripe-test-checkout] failed to create subscription", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
