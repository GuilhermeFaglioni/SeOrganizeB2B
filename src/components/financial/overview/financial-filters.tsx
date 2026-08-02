"use client";

import type { OverviewFilters } from "@/hooks/use-overview";

const PERIODS = [
  { value: "currentMonth", label: "Current month" },
  { value: "next90", label: "Next 90 days" },
  { value: "custom", label: "Custom" },
] as const;

export function FinancialFilters({
  filters,
  onChange,
}: {
  filters: OverviewFilters;
  onChange: (next: OverviewFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => onChange({ ...filters, period: period.value })}
            className={`rounded-md px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
              filters.period === period.value
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>
      {filters.period === "custom" && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">
            From
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(event) => onChange({ ...filters, from: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-text-secondary">
            To
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(event) => onChange({ ...filters, to: event.target.value || undefined })}
              className="ml-2 rounded-md border border-border bg-page-alt px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
