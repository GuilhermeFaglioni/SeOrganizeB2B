"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOverview, type OverviewFilters } from "@/hooks/use-overview";
import { useProjects } from "@/hooks/use-projects";
import { useClients } from "@/hooks/use-clients";
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
  const t = useTranslations("financial.overview.page");
  const [filters, setFilters] = useState<OverviewFilters>({
    period: "currentMonth",
  });
  const { data, isLoading, isError, refetch } = useOverview(filters);
  const { data: projects } = useProjects();
  const { data: clientsData } = useClients({ pageSize: 100 });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message={t("errorMessage")} onRetry={() => refetch()} />;
  }

  const { kpis, monthly, overdueInstallments, expiringContracts } = data;

  return (
    <div className="space-y-6">
      <FinancialFilters filters={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center gap-3" role="group" aria-label={t("globalFilters")}>
        <label className="text-sm text-text-secondary">
          {t("client")}
          <select
            value={filters.clientId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, clientId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allClients")}</option>
            {clientsData?.items.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          {t("project")}
          <select
            value={filters.projectId ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, projectId: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allProjects")}</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          {t("contractStatus")}
          <select
            value={filters.contractStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, contractStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allStatuses")}</option>
            {["draft", "active", "closed", "cancelled", "suspended"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-text-secondary">
          {t("installmentStatus")}
          <select
            value={filters.installmentStatus ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, installmentStatus: event.target.value || undefined })
            }
            className="ml-2 rounded-md border border-border bg-page-alt px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="">{t("allInstallments")}</option>
            {["pending", "paid", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-live="polite"
        aria-label={t("kpisAriaLabel")}
      >
        <KpiCard label={t("activeContractedValue")} value={kpis.activeContractedValue} />
        <KpiCard label={t("mrr")} value={kpis.mrr} />
        <KpiCard label={t("arr")} value={kpis.arr} />
        <KpiCard label={t("cashForecast")} value={kpis.cashForecast} />
        <KpiCard label={t("received")} value={kpis.received} />
        <KpiCard label={t("overdue")} value={kpis.overdue} />
        <KpiCard label={t("upsell")} value={kpis.upsell} />
        <KpiCard label={t("downsell")} value={kpis.downsell} />
        <KpiCard label={t("activeContracts")} value={kpis.activeContracts} isMoney={false} />
        <KpiCard label={t("expiringSoon")} value={kpis.expiringSoon} isMoney={false} />
      </div>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="mb-2 text-base font-semibold text-text-primary">
          {t("forecastVsReceived")}
        </h2>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <ForecastReceivedChart data={monthly} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="overdue-title">
          <h2 id="overdue-title" className="mb-2 text-base font-semibold text-text-primary">
            {t("overdueInstallments")}
          </h2>
          {overdueInstallments.length === 0 ? (
            <FinancialEmptyState title={t("nothingOverdue")} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt" aria-label={t("overdueListAria")}>
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
            {t("expiringContracts")}
          </h2>
          {expiringContracts.length === 0 ? (
            <FinancialEmptyState title={t("nothingExpiring")} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-page-alt" aria-label={t("expiringListAria")}>
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
