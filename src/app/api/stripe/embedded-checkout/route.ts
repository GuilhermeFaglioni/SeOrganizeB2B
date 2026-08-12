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

    const session = await stripe.checkout.sessions.create({
      ui_mode: "elements",
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_creation: "always",
      return_url: `${request.nextUrl.origin}/test-checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { source: "test-landing", planId: plan.id },
    });

    return NextResponse.json({
      data: { clientSecret: session.client_secret },
      error: null,
    });
  } catch (error) {
    console.error("[stripe-embedded-checkout] failed to create checkout session", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
