"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export interface TestCheckoutPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
}

export function TestCheckoutLanding({
  plans,
}: {
  plans: TestCheckoutPlan[];
}) {
  const t = useTranslations("testCheckout");
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

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

  async function fetchClientSecret(): Promise<string> {
    const response = await fetch("/api/stripe/embedded-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId: selectedPriceId }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.data?.clientSecret) {
      throw new Error(payload.error?.message ?? t("checkoutFailed"));
    }
    return payload.data.clientSecret as string;
  }

  const selectedPlan = plans.find(
    (plan) => plan.stripePriceId === selectedPriceId
  );

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

        {selectedPlan ? (
          <div className="space-y-4">
            <p className="text-body font-semibold text-text-primary">
              {t("selectedPlan", { plan: selectedPlan.name })}
            </p>
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
            <div className="text-center">
              <Button variant="ghost" onClick={() => setSelectedPriceId(null)}>
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
                      plan.stripePriceId && setSelectedPriceId(plan.stripePriceId)
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
