import Stripe from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "../../../../../prisma/client";
import { setWorkspacePlanAndLeaveClosedBeta } from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

function getCustomerId(event: Stripe.Event): string | null {
  const object = event.data.object as
    | Stripe.Invoice
    | Stripe.Subscription
    | Stripe.Checkout.Session;
  return typeof object.customer === "string" ? object.customer : null;
}

async function planIdForSubscription(
  subscription: Stripe.Subscription | null | undefined
): Promise<string | null> {
  const priceId = subscription?.items.data[0]?.price.id;
  if (!priceId) return null;
  const plan = await prisma.plan.findFirst({
    where: { stripePriceId: priceId, isInternal: false },
  });
  return plan?.id ?? null;
}

async function resolvePlanByCustomer(customerId: string): Promise<string | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
  });
  return planIdForSubscription(subscriptions.data[0]);
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
  if (data.planId) {
    await setWorkspacePlanAndLeaveClosedBeta(workspace.id, data.planId, {
      userId: "stripe-webhook",
      email: "system",
    });
    const workspaceData = { ...data };
    delete workspaceData.planId;
    if (Object.keys(workspaceData).length > 0) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: workspaceData,
      });
    }
    return;
  }
  await prisma.workspace.update({ where: { id: workspace.id }, data });
}

async function activateWorkspace(customerId: string): Promise<void> {
  const planId = await resolvePlanByCustomer(customerId);
  await updateWorkspace(customerId, {
    status: "active",
    gracePeriodEndsAt: null,
    ...(planId ? { planId } : {}),
  });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const customerId = getCustomerId(event);
  if (!customerId) {
    console.warn(`[stripe-webhook] no customer id on ${event.type}`);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      console.log(
        `[stripe-webhook] checkout.session.completed for customer ${customerId}`
      );
      await activateWorkspace(customerId);
      break;
    }

    case "invoice.payment_succeeded": {
      console.log(
        `[stripe-webhook] invoice.payment_succeeded for customer ${customerId}`
      );
      await activateWorkspace(customerId);
      break;
    }

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
      const planId = await planIdForSubscription(
        event.data.object as Stripe.Subscription
      );
      await updateWorkspace(customerId, {
        stripeCustomerId: customerId,
        ...(planId ? { planId } : {}),
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
