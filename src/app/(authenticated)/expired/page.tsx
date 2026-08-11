"use client";

import { useTranslations } from "next-intl";
import { APP_NAME } from "@/lib/constants";

export default function WorkspaceExpiredPage() {
  const t = useTranslations("billing.expired");

  return (
    <div
      data-testid="workspace-expired-page"
      className="flex min-h-full items-center justify-center p-4"
    >
      <div className="w-full max-w-[420px] space-y-4 rounded-xl bg-page-alt p-8 text-center shadow-card">
        <h1 className="text-display text-text-primary">{APP_NAME}</h1>
        <p className="text-body text-text-secondary">{t("title")}</p>
        <p className="text-body-small text-text-muted">{t("message")}</p>
      </div>
    </div>
  );
}