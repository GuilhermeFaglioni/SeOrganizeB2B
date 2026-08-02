"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatBRL, toDecimal } from "@/lib/financial/money";

export function KpiCard({
  label,
  value,
  isMoney = true,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  isMoney?: boolean;
  hint?: string;
  className?: string;
}) {
  const t = useTranslations("financial.shared.kpi");
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-page-alt p-4",
        className
      )}
      aria-label={t("labelValue", { label, value })}
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">
        {isMoney ? formatBRL(toDecimal(String(value))) : value}
      </p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
