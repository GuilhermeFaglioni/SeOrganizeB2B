"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TestCheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("shared.errorBoundary");

  useEffect(() => {
    console.error("[test-checkout] render failed", error);
  }, [error]);

  return (
    <div
      data-testid="test-checkout-error"
      className="flex min-h-full items-center justify-center p-4"
    >
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-page-alt p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-danger" />
        <h1 className="text-heading-1 text-text-primary">{t("title")}</h1>
        <p className="text-body text-text-secondary">{t("unexpectedError")}</p>
        <Button onClick={reset}>{t("tryAgain")}</Button>
      </div>
    </div>
  );
}
