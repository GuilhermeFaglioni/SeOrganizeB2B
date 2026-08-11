"use client";

import { useTranslations } from "next-intl";
import { useWorkspaceContext } from "@/stores/workspace-context";

export function GracePeriodBanner() {
  const t = useTranslations("billing.gracePeriod");
  const { workspace } = useWorkspaceContext();

  if (!workspace?.gracePeriodEndsAt) return null;

  const date = new Date(workspace.gracePeriodEndsAt).toLocaleDateString();

  return (
    <div
      data-testid="grace-period-banner"
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-center text-sm text-warning"
    >
      <span>{t("message", { date })}</span>
    </div>
  );
}