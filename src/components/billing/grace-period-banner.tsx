"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export function GracePeriodBanner() {
  const t = useTranslations("billing.gracePeriod");
  const { workspace } = useWorkspaceContext();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!workspace?.gracePeriodEndsAt) return null;

  const date = new Date(workspace.gracePeriodEndsAt).toLocaleDateString();

  async function handleUpdatePayment() {
    setIsRedirecting(true);
    try {
      const { url } = await fetchJson<{ url: string }>("/api/stripe/portal", {
        method: "POST",
      });
      window.location.href = url;
    } catch {
      toastError(t("portalFailed"));
      setIsRedirecting(false);
    }
  }

  return (
    <div
      data-testid="grace-period-banner"
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 bg-warning-bg px-4 py-2 text-center text-sm text-warning"
    >
      <span>{t("message", { date })}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-warning text-warning hover:bg-warning-bg hover:text-warning"
        onClick={handleUpdatePayment}
        disabled={isRedirecting}
      >
        {t("updatePayment")}
      </Button>
    </div>
  );
}