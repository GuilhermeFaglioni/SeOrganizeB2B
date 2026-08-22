"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { Button } from "@/components/ui/button";
import { warningLimits } from "@/lib/workspace/limits";
import { pushWithAIStudioGuard } from "@/lib/ai/studio-router-guard";

export function UpgradeBanner() {
  const t = useTranslations("billing.upgradeBanner");
  const router = useRouter();
  const { workspace } = useWorkspaceContext();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const warnings = warningLimits(workspace?.features.limits);

  if (warnings.length === 0) return null;

  const { resource, used, limit } = warnings[0];
  const resourceLabel = t.has(`resources.${resource}`)
    ? t(`resources.${resource}`)
    : resource;

  function handleUpgrade() {
    if (pushWithAIStudioGuard(router, "/plans")) setIsRedirecting(true);
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
        disabled={isRedirecting}
      >
        {isRedirecting ? t("upgrading") : t("upgrade")}
      </Button>
    </div>
  );
}
