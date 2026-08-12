"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export function PlansReturnView({ status }: { status: string | null }) {
  const t = useTranslations("plans");
  const queryClient = useQueryClient();
  const success = status === "complete";
  const Icon = success ? CheckCircle2 : XCircle;

  useEffect(() => {
    if (success) {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["me", "permissions"] });
    }
  }, [success, queryClient]);

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div
        data-testid="plans-return"
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-white p-6 text-center shadow-card"
      >
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            success ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          }`}
        >
          <Icon size={24} aria-hidden="true" />
        </div>
        <h1
          className={`text-title ${
            success ? "text-text-primary" : "text-danger"
          }`}
        >
          {success ? t("return.success") : t("return.notComplete")}
        </h1>
        <p className="text-body text-text-secondary">
          {success
            ? t("return.successDescription")
            : t("return.notCompleteDescription")}
        </p>
        {status === null && (
          <p className="text-body-small text-text-muted">
            {t("return.missingSession")}
          </p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild variant="outline">
            <a href="/plans">{t("back")}</a>
          </Button>
          <Button asChild>
            <a href="/app">{t("return.goToApp")}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
