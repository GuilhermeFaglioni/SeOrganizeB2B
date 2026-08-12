import type { Metadata } from "next";
import { stripe } from "@/lib/stripe";
import { CheckoutReturnView } from "./return-view";

export const metadata: Metadata = {
  title: "Pagamento",
};

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: { session_id?: string | string[] };
}) {
  const sessionId = Array.isArray(searchParams.session_id)
    ? searchParams.session_id[0]
    : searchParams.session_id;

  let status: string | null = null;
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      status = session.status ?? null;
    } catch (error) {
      console.error("[test-checkout-return] failed to retrieve session", error);
    }
  }

  return <CheckoutReturnView status={status} />;
}
