import type { Metadata } from "next";
import { stripe } from "@/lib/stripe";
import { paymentIntentStatusToCheckoutStatus } from "@/lib/stripe-return-status";
import { CheckoutReturnView } from "./return-view";

export const metadata: Metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
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
      console.error("[test-checkout-return] failed to retrieve payment intent", error);
    }
  }

  return <CheckoutReturnView status={status} />;
}
