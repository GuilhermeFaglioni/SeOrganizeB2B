"use client";

import { useTranslations } from "next-intl";
import type { OverviewFilters } from "@/hooks/use-overview";

const PERIODS = ["currentMonth", "next90", "custom"] as const;

export function FinancialFilters({
  filters,
  onChange,
}: {
  filters: OverviewFilters;
  onChange: (next: OverviewFilters) => void;
}) {
  const t = useTranslations("financial.overview.filters");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
        {PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => onChange({ ...filters, period })}
            className={`rounded-md px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              filters.period === period
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {t(period)}
          </button>
        ))}
      </div>
      {filters.period === "custom" && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">
            {t("from")}
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ ...filters, from: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
          <label className="text-sm text-text-secondary">
            {t("to")}
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ ...filters, to: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  );
}
