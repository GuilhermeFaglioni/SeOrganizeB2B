"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CheckoutReturnView({ status }: { status: string | null }) {
  const t = useTranslations("testCheckout");
  const success = status === "complete";

  return (
    <div
      data-testid="test-checkout-return"
      className="flex min-h-full items-center justify-center p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-page-alt p-6 text-center shadow-card">
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
        <div className="pt-2">
          <Button asChild variant="outline">
            <a href="/test-checkout">{t("back")}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
