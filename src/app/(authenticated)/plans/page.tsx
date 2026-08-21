"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeElements } from "@stripe/stripe-js";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { usePlans } from "@/hooks/use-plans";
import { useWorkspace } from "@/hooks/use-workspace";
import { Check, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function PlansPage() {
  const t = useTranslations("plans");
  const { data: plans, isLoading } = usePlans();
  const { data: workspace } = useWorkspace();

  const purchasablePlans = (plans ?? []).filter((plan) => plan.stripePriceId);

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
      elementsRef.current = null;
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
          return_url: `${window.location.origin}/plans/return`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setCheckoutError(result.error.message ?? t("checkoutFailed"));
      }
      if (!result.error && result.paymentIntent) {
        window.location.href = `/plans/return?payment_intent=${result.paymentIntent.id}`;
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
    elementsRef.current = null;
    setClientSecret(null);
    setCheckoutError(null);
    setSelectedPriceId(null);
    setConfirming(false);
  }

  const selectedPlan = purchasablePlans.find(
    (plan) => plan.stripePriceId === selectedPriceId
  );
  const currentPlanId = workspace?.plan?.id;

  if (!publishableKey) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <p className="max-w-md rounded-xl border border-border bg-page-alt p-4 text-center text-body text-text-secondary">
          {t("missingKey")}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-[960px] space-y-6">
        <div className="space-y-2">
          <h2 className="text-display text-text-primary">{t("title")}</h2>
          <p className="max-w-xl text-body text-text-secondary">
            {t("description")}
          </p>
        </div>

        {checkoutError && (
          <p
            data-testid="plans-checkout-error"
            role="alert"
            className="text-body-small text-danger"
          >
            {checkoutError}
          </p>
        )}

        {isLoading ? (
          <LoadingState />
        ) : selectedPlan ? (
          <div className="space-y-4">
            <p className="text-body font-semibold text-text-primary">
              {t("selectedPlan", { plan: selectedPlan.name })}
            </p>
            {loading ? (
              <LoadingState />
            ) : clientSecret ? (
              <div className="space-y-3">
                <div
                  ref={mountRef}
                  data-testid="plans-payment-element"
                  className="balsa-surface rounded-balsa-surface p-4"
                />
                <div className="flex items-center gap-3">
                  <Button disabled={confirming} onClick={handleConfirm}>
                    {confirming ? t("processing") : t("confirm")}
                  </Button>
                  <Button variant="ghost" onClick={handleBack}>
                    {t("back")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : purchasablePlans.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {purchasablePlans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <div
                  key={plan.id}
                  data-testid={`plan-${plan.id}`}
                  className={cn(
                    "balsa-surface flex flex-col gap-3 rounded-balsa-surface p-5",
                    isCurrent && "ring-1 ring-balsa-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-heading-2 text-text-primary">
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-caption text-brand-700">
                        <Sparkles size={12} aria-hidden="true" />
                        {t("currentPlan")}
                      </span>
                    )}
                  </div>
                  <p className="text-body-small text-text-secondary">
                    {plan.allowedModules.length} {t("modulesCount")}
                  </p>
                  <div className="mt-auto">
                    <Button
                      className="w-full"
                      disabled={!plan.stripePriceId || isCurrent}
                      onClick={() =>
                        plan.stripePriceId && handleSubscribe(plan.stripePriceId)
                      }
                    >
                      {isCurrent ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        <Lock size={16} aria-hidden="true" />
                      )}
                      {isCurrent ? t("currentPlan") : t("subscribe")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-body-small text-text-muted">{t("noPlans")}</p>
        )}
      </div>
    </div>
  );
}
