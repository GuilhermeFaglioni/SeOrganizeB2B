"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";
import { warningLimits } from "@/lib/workspace/limits";

interface PlanOption {
  id: string;
  name: string;
  allowedModules: string[];
  stripePriceId: string | null;
}

export function UpgradeBanner() {
  const t = useTranslations("billing.upgradeBanner");
  const { workspace } = useWorkspaceContext();
  const { data: plans } = useQuery<PlanOption[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJson<PlanOption[]>("/api/plans"),
    staleTime: 60 * 1000,
  });
  const [isRedirecting, setIsRedirecting] = useState(false);

  const warnings = warningLimits(workspace?.features.limits);
  const currentPlanId = workspace?.plan?.id;
  const priceId =
    plans?.find((plan) => plan.id === currentPlanId)?.stripePriceId ?? null;

  if (warnings.length === 0) return null;

  const { resource, used, limit } = warnings[0];
  const resourceLabel = t.has(`resources.${resource}`)
    ? t(`resources.${resource}`)
    : resource;

  async function handleUpgrade() {
    if (!priceId) return;
    setIsRedirecting(true);
    try {
      const { url } = await fetchJson<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      window.location.href = url;
    } catch {
      toastError(t("checkoutFailed"));
      setIsRedirecting(false);
    }
  }

  return (
    <div
      data-testid="upgrade-banner"
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 bg-info-bg px-4 py-2 text-center text-sm text-info"
    >
      <span>
        {t("message", { resource: resourceLabel })} ·{" "}
        {t("usage", { used, limit })}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-info text-info hover:bg-info-bg hover:text-info"
        onClick={handleUpgrade}
        disabled={isRedirecting || !priceId}
      >
        {isRedirecting ? t("upgrading") : t("upgrade")}
      </Button>
    </div>
  );
}
