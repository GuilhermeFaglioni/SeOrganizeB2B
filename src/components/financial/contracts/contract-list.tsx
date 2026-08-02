"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useContracts, type ContractListFilters } from "@/hooks/use-contracts";
import { useClients } from "@/hooks/use-clients";
import { useProjects } from "@/hooks/use-projects";
import { exportContractsCsv } from "@/hooks/use-financial-exports";
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
  const [filters, setFilters] = useState<ContractListFilters>({
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const { data, isLoading, isError, refetch } = useContracts(filters);
  const { data: clientsData } = useClients({ pageSize: 100 });
  const { data: projects } = useProjects();

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load contracts" onRetry={() => refetch()} />;
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
          <Link
            href="/financial/contracts/new"
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} aria-hidden="true" /> New contract
          </Link>
        </div>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No contracts match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Contracts</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Code</th>
                <th scope="col" className="px-3 py-2 font-medium">Title</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Official value</th>
                <th scope="col" className="px-3 py-2 font-medium">Start</th>
                <th scope="col" className="px-3 py-2 font-medium">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((contract) => (
                <tr key={contract.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{contract.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{contract.client.name}</td>
                  <td className="px-3 py-2"><StatusBadge status={contract.status} /></td>
                  <td className="px-3 py-2 font-medium"><MoneyText value={contract.officialValue} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.startDate} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={contract.endDate} /></td>
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
