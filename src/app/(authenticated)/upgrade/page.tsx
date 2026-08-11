"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { APP_NAME } from "@/lib/constants";

export interface PlanOption {
  id: string;
  name: string;
  allowedModules: string[];
  stripePriceId: string | null;
}

export function usePlans() {
  return useQuery<PlanOption[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJson<PlanOption[]>("/api/plans"),
    staleTime: 60 * 1000,
  });
}

export default function UpgradePage() {
  const t = useTranslations("upgrade");
  const searchParams = useSearchParams();
  const router = useRouter();
  const moduleName = searchParams.get("module") || "financial";
  const { data: plans, isLoading } = usePlans();
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [checkoutFailed, setCheckoutFailed] = useState(false);

  const moduleLabel = t.has(`moduleNames.${moduleName}`)
    ? t(`moduleNames.${moduleName}`)
    : moduleName;

  async function handleUpgrade(priceId: string) {
    setUpgradingId(priceId);
    setCheckoutFailed(false);
    try {
      const { url } = await fetchJson<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (url) {
        window.location.href = url;
        return;
      }
      setUpgradingId(null);
    } catch {
      setCheckoutFailed(true);
      setUpgradingId(null);
    }
  }

  return (
    <div
      data-testid="upgrade-page"
      className="flex min-h-full items-center justify-center p-4"
    >
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-display text-text-primary">{APP_NAME}</h1>
          <h2 className="text-title text-text-primary">{t("title")}</h2>
          <p className="text-body text-text-secondary">
            {t("description", { module: moduleLabel })}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-body font-semibold text-text-primary">
            {t("plansTitle")}
          </h3>
          {isLoading ? (
            <LoadingState />
          ) : plans && plans.length > 0 ? (
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
                  disabled={!plan.stripePriceId || upgradingId === plan.stripePriceId}
                  onClick={() =>
                    plan.stripePriceId && handleUpgrade(plan.stripePriceId)
                  }
                >
                  {upgradingId === plan.stripePriceId
                    ? t("upgrading")
                    : t("upgrade")}
                </Button>
              </div>
            ))
          ) : (
            <p className="text-body-small text-text-muted">{t("noPlans")}</p>
          )}
        </div>

        {checkoutFailed && (
          <p role="alert" className="text-body-small text-danger">
            {t("checkoutFailed")}
          </p>
        )}

        <div className="text-center">
          <Button variant="ghost" onClick={() => router.push("/")}>
            {t("backToApp")}
          </Button>
        </div>
      </div>
    </div>
  );
}