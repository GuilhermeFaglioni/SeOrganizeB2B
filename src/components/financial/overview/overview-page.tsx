"use client";

import { useState } from "react";
import { useOverview, type OverviewFilters } from "@/hooks/use-overview";
import { KpiCard } from "@/components/financial/shared/kpi-card";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ForecastReceivedChart } from "@/components/financial/overview/forecast-received-chart";
import { FinancialFilters } from "@/components/financial/overview/financial-filters";
import { LoadingState } from "@/components/shared/loading-state";

export function OverviewPage() {
  const [filters, setFilters] = useState<OverviewFilters>({
    period: "currentMonth",
  });
  const { data, isLoading, isError, refetch } = useOverview(filters);

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load the financial overview" onRetry={() => refetch()} />;
  }

  const { kpis, monthly, overdueInstallments, expiringContracts } = data;

  return (
    <div className="space-y-6">
      <FinancialFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active contracted value" value={kpis.activeContractedValue} />
        <KpiCard label="MRR" value={kpis.mrr} />
        <KpiCard label="ARR" value={kpis.arr} />
        <KpiCard label="Cash forecast" value={kpis.cashForecast} />
        <KpiCard label="Received" value={kpis.received} />
        <KpiCard label="Overdue" value={kpis.overdue} />
        <KpiCard label="Upsell" value={kpis.upsell} />
        <KpiCard label="Downsell" value={kpis.downsell} />
        <KpiCard label="Active contracts" value={kpis.activeContracts} isMoney={false} />
        <KpiCard label="Expiring soon" value={kpis.expiringSoon} isMoney={false} />
      </div>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="mb-2 text-base font-semibold text-text-primary">
          Forecast vs. Received
        </h2>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <ForecastReceivedChart data={monthly} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="overdue-title">
          <h2 id="overdue-title" className="mb-2 text-base font-semibold text-text-primary">
            Overdue installments
          </h2>
          {overdueInstallments.length === 0 ? (
            <FinancialEmptyState title="Nothing overdue" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {overdueInstallments.map((installment) => (
                <li key={installment.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{installment.contractTitle}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {installment.clientName} · {installment.contractCode}
                    </p>
                  </div>
                  <CivilDateText date={installment.dueDate} className="text-xs text-text-muted" />
                  <MoneyText value={installment.expectedAmount} className="font-semibold text-danger" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="expiring-title">
          <h2 id="expiring-title" className="mb-2 text-base font-semibold text-text-primary">
            Expiring contracts
          </h2>
          {expiringContracts.length === 0 ? (
            <FinancialEmptyState title="Nothing expiring in the next 30 days" />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt">
              {expiringContracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{contract.title}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {contract.clientName} · {contract.code}
                    </p>
                  </div>
                  <StatusBadge status={contract.status ?? "active"} />
                  <CivilDateText date={contract.endDate} className="text-xs text-text-muted" />
                  <MoneyText value={contract.officialValue} className="font-semibold text-text-primary" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
