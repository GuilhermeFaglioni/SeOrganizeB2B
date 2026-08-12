"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeElements } from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export interface TestCheckoutPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function TestCheckoutLanding({
  plans,
}: {
  plans: TestCheckoutPlan[];
}) {
  const t = useTranslations("testCheckout");
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const elementsRef = useRef<StripeElements | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientSecret || !stripePromise || !mountRef.current) return;

    (async () => {
      const stripe = await stripePromise;
      if (!stripe) return;

      const elements = stripe.elements({ clientSecret });
      elementsRef.current = elements;

      const paymentElement = elements.create("payment");
      paymentElement.mount(mountRef.current!);
    })();

    return () => {
      if (elementsRef.current) {
        elementsRef.current = null;
      }
    };
  }, [clientSecret]);

  async function handleSubscribe(priceId: string) {
    setSelectedPriceId(priceId);
    setCheckoutError(null);
    setClientSecret(null);
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/embedded-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.data?.clientSecret) {
        throw new Error(payload.error?.message ?? t("checkoutFailed"));
      }
      setClientSecret(payload.data.clientSecret as string);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : t("checkoutFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!elementsRef.current || !stripePromise) return;
    setConfirming(true);
    setCheckoutError(null);
    try {
      const stripe = await stripePromise;
      if (!stripe) return;
      const result = await stripe.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/test-checkout/return`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setCheckoutError(result.error.message ?? t("checkoutFailed"));
      }
      // If no error and no redirect, navigate to the return page with the
      // payment intent so it can resolve the final status server-side.
      if (!result.error && result.paymentIntent) {
        window.location.href = `/test-checkout/return?payment_intent=${result.paymentIntent.id}`;
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : t("checkoutFailed")
      );
    } finally {
      setConfirming(false);
    }
  }

  function handleBack() {
    if (elementsRef.current) {
      elementsRef.current = null;
    }
    setClientSecret(null);
    setCheckoutError(null);
    setSelectedPriceId(null);
    setConfirming(false);
  }

  const selectedPlan = plans.find(
    (plan) => plan.stripePriceId === selectedPriceId
  );

  if (!publishableKey) {
    return (
      <div
        data-testid="test-checkout-missing-key"
        className="flex min-h-full items-center justify-center p-4"
      >
        <p className="max-w-md rounded-xl border border-border bg-page-alt p-4 text-center text-body text-text-secondary">
          {t("missingKey")}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="test-checkout-page"
      className="flex min-h-full items-center justify-center p-4"
    >
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-display text-text-primary">{APP_NAME}</h1>
          <h2 className="text-title text-text-primary">{t("title")}</h2>
          <p className="text-body text-text-secondary">{t("description")}</p>
        </div>

        {checkoutError && (
          <p
            data-testid="checkout-error"
            role="alert"
            className="text-body-small text-danger"
          >
            {checkoutError}
          </p>
        )}

        {selectedPlan ? (
          <div className="space-y-4">
            <p className="text-body font-semibold text-text-primary">
              {t("selectedPlan", { plan: selectedPlan.name })}
            </p>
            {loading ? (
              <p className="text-body text-text-muted text-center">
                Carregando...
              </p>
            ) : clientSecret ? (
              <div className="space-y-3">
                <div
                  ref={mountRef}
                  data-testid="stripe-elements-container"
                  className="rounded-xl border border-border bg-page-alt p-4 shadow-card"
                />
                <div className="text-center">
                  <Button
                    disabled={confirming}
                    onClick={handleConfirm}
                  >
                    {confirming ? "Processando..." : "Confirmar pagamento"}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="text-center">
              <Button variant="ghost" onClick={handleBack}>
                {t("back")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-body font-semibold text-text-primary">
              {t("plansTitle")}
            </h3>
            {plans.length > 0 ? (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  data-testid={`plan-${plan.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl bg-page-alt p-4 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-text-primary">
                      {plan.name}
                    </p>
                    <p className="text-body-small text-text-muted">
                      {plan.allowedModules.length} {t("modulesCount")}
                    </p>
                  </div>
                  <Button
                    disabled={!plan.stripePriceId}
                    onClick={() =>
                      plan.stripePriceId && handleSubscribe(plan.stripePriceId)
                    }
                  >
                    {t("subscribe")}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-body-small text-text-muted">{t("noPlans")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
