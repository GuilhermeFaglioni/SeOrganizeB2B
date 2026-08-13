"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { useContracts, useDeleteContract, type ContractListFilters } from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { useCan } from "@/hooks/use-permissions";
import { exportContractsCsv } from "@/hooks/use-financial-exports";
import { toastSuccess } from "@/lib/toast";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { ContractSearchFilters } from "@/components/financial/contracts/contract-search-filters";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractList() {
  const t = useTranslations("financial.contracts.list");
  const [filters, setFilters] = useState<ContractListFilters>({
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const { data, isLoading, isError, refetch } = useContracts(filters);
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();
  const deleteContract = useDeleteContract();
  const { can } = useCan();

  function handleDelete(contract: { id: string; title: string | null }) {
    if (
      !window.confirm(
        t("confirmDelete", { title: contract.title ?? contract.id })
      )
    ) {
      return;
    }
    deleteContract.mutate(contract.id, {
      onSuccess: () => toastSuccess(t("contractDeleted")),
    });
  }

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message={t("loadFailed")} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContractSearchFilters
          values={filters}
          onChange={(next) => setFilters({ ...filters, ...next, page: 1 })}
          clients={clientsData?.items}
          projects={projects}
        />
        <div className="flex items-center gap-2">
          <CsvExportButton onExport={() => exportContractsCsv({ search: filters.search, status: filters.status, clientId: filters.clientId, projectId: filters.projectId })} />
          {can("financial.contracts.create") && (
            <Link
              href="/financial/contracts/new"
              className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Plus size={16} aria-hidden="true" /> {t("newContract")}
            </Link>
          )}
        </div>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState
          title={t("emptyTitle")}
          hint={filters.search ? t("emptyHint", { search: filters.search }) : t("emptyHintDefault")}
          action={
            !filters.search && can("financial.contracts.create")
              ? { label: t("emptyAction"), href: "/financial/contracts/new" }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt" aria-live="polite">
          <table className="w-full min-w-[720px] text-left text-sm" aria-label={t("tableLabel")}>
            <caption className="sr-only">{t("tableLabel")}</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t("colCode")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colTitle")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colClient")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colStatus")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colOfficialValue")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colStart")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colEnd")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((contract) => (
                <tr key={contract.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{contract.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${contract.id}`}
                      className="font-medium text-text-primary hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{contract.client.name}</td>
                  <td className="px-3 py-2"><StatusBadge status={contract.status} /></td>
                  <td className="px-3 py-2 font-medium"><MoneyText value={contract.officialValue} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.startDate} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.endDate} /></td>
                  <td className="px-3 py-2">
                    {can("financial.contracts.delete") && (
                      <button
                        type="button"
                        onClick={() => handleDelete(contract)}
                        aria-label={t("deleteAria", { code: contract.code })}
                        className="flex min-h-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ ...filters, page })}
      />
    </div>
  );
}
