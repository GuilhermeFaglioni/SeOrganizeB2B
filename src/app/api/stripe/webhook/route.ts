import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

function getCustomerId(event: Stripe.Event): string | null {
  const object = event.data.object as Stripe.Invoice | Stripe.Subscription;
  return typeof object.customer === "string" ? object.customer : null;
}

async function updateWorkspace(
  customerId: string,
  data: Partial<{
    status: string;
    gracePeriodEndsAt: Date | null;
    cancelledAt: Date | null;
    planId: string | null;
    stripeCustomerId: string;
  }>
): Promise<void> {
  const workspace = await prisma.workspace.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!workspace) {
    console.warn(
      `[stripe-webhook] no workspace found for customer ${customerId}`
    );
    return;
  }
  await prisma.workspace.update({
    where: { id: workspace.id },
    data,
  });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const customerId = getCustomerId(event);
  if (!customerId) {
    console.warn(`[stripe-webhook] no customer id on ${event.type}`);
    return;
  }

  switch (event.type) {
    case "invoice.payment_succeeded":
      console.log(
        `[stripe-webhook] invoice.payment_succeeded for customer ${customerId}`
      );
      await updateWorkspace(customerId, {
        status: "active",
        gracePeriodEndsAt: null,
      });
      break;

    case "invoice.payment_failed":
      console.log(
        `[stripe-webhook] invoice.payment_failed for customer ${customerId}`
      );
      await updateWorkspace(customerId, {
        status: "grace_period",
        gracePeriodEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });
      break;

    case "customer.subscription.deleted":
      console.log(
        `[stripe-webhook] customer.subscription.deleted for customer ${customerId}`
      );
      await updateWorkspace(customerId, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      break;

    case "customer.subscription.updated": {
      console.log(
        `[stripe-webhook] customer.subscription.updated for customer ${customerId}`
      );
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId
        ? await prisma.plan.findFirst({ where: { stripePriceId: priceId } })
        : null;
      await updateWorkspace(customerId, {
        stripeCustomerId: customerId,
        ...(plan ? { planId: plan.id } : {}),
      });
      break;
    }

    default:
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SECRET ?? ""
    );
  } catch (error) {
    console.error("[stripe-webhook] invalid signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(
      `[stripe-webhook] error processing ${event.type}`,
      error
    );
  }

  return NextResponse.json({ received: true });
}