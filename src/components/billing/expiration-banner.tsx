"use client";

import { useTranslations } from "next-intl";
import { useWorkspaceContext } from "@/stores/workspace-context";

export function ExpirationBanner() {
  const t = useTranslations("billing.expiration");
  const { workspace } = useWorkspaceContext();

  if (!workspace?.gracePeriodEndsAt) return null;

  const date = new Date(workspace.gracePeriodEndsAt).toLocaleDateString();

  return (
    <div
      data-testid="expiration-banner"
      role="alert"
      className="flex items-center justify-center gap-2 bg-danger-bg px-4 py-2 text-center text-sm text-danger"
    >
      <span>{t("message", { date })}</span>
    </div>
  );
}