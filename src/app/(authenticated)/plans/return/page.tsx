import type { Metadata } from "next";
import { stripe } from "@/lib/stripe";
import { paymentIntentStatusToCheckoutStatus } from "@/lib/stripe-return-status";
import { PlansReturnView } from "./return-view";

export const metadata: Metadata = {
  title: "Pagamento",
};

export const dynamic = "force-dynamic";

export default async function PlansReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const paymentIntentId = Array.isArray(resolvedSearchParams.payment_intent)
    ? resolvedSearchParams.payment_intent[0]
    : resolvedSearchParams.payment_intent;

  let status: string | null = null;
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      status = paymentIntentStatusToCheckoutStatus(paymentIntent.status);
    } catch (error) {
      console.error("[plans-return] failed to retrieve payment intent", error);
    }
  }

  return <PlansReturnView status={status} />;
}
