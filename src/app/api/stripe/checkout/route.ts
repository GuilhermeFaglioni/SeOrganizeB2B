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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.nextUrl.origin}/app`,
      cancel_url: `${request.nextUrl.origin}/app`,
      metadata: { workspaceId: workspace.id },
    });

    return NextResponse.json({ data: { url: session.url }, error: null });
  } catch (error) {
    console.error("[stripe-checkout] failed to create checkout session", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
