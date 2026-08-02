"use client";

import { useTranslations } from "next-intl";

export function FinancialErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("financial.shared.errorState");
  return (
    <div role="alert" className="rounded-xl border border-danger bg-danger-bg p-4 text-sm text-danger">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
