import type { Metadata } from "next";
import { stripe } from "@/lib/stripe";
import { paymentIntentStatusToCheckoutStatus } from "@/lib/stripe-return-status";
import { CheckoutReturnView } from "./return-view";

export const metadata: Metadata = {
  title: "Pagamento",
};

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: { payment_intent?: string | string[] };
}) {
  const paymentIntentId = Array.isArray(searchParams.payment_intent)
    ? searchParams.payment_intent[0]
    : searchParams.payment_intent;

  let status: string | null = null;
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      status = paymentIntentStatusToCheckoutStatus(paymentIntent.status);
    } catch (error) {
      console.error("[test-checkout-return] failed to retrieve payment intent", error);
    }
  }

  return <CheckoutReturnView status={status} />;
}
