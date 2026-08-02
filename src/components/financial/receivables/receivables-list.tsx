"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";
import { exportReceivablesCsv } from "@/hooks/use-financial-exports";
import { useProjects } from "@/hooks/use-projects";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { CsvExportButton } from "@/components/financial/contracts/csv-export-button";
import { Pagination } from "@/components/financial/contracts/pagination";
import { InstallmentActions } from "@/components/financial/receivables/installment-actions";
import { LoadingState } from "@/components/shared/loading-state";
import type { Paginated } from "@/lib/financial/types";

interface ReceivableRow {
  id: string;
  expectedAmount: string;
  dueDate: string;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  refundOfId: string | null;
  contract: {
    id: string;
    code: string;
    title: string;
    client: { name: string };
  };
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export function ReceivablesList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<Paginated<ReceivableRow>>({
    queryKey: ["receivables", { status, page, projectId }],
    queryFn: () =>
      fetchJson<Paginated<ReceivableRow>>(
        `/api/receivables${qs({ status, page, pageSize, projectId })}`
      ),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <FinancialErrorState message="Failed to load receivables" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-page-alt p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  status === tab.value
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-bg-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {projects && projects.length > 0 && (
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-page-alt px-2 py-2 text-sm"
              aria-label="Filter by project"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <CsvExportButton
          label="Export CSV"
          onExport={() => exportReceivablesCsv({ status, projectId })}
        />
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No installments match your filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Receivables</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Contract</th>
                <th scope="col" className="px-3 py-2 font-medium">Client</th>
                <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                <th scope="col" className="px-3 py-2 font-medium">Due date</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((installment) => (
                <tr key={installment.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/contracts/${installment.contract.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {installment.contract.title}
                    </Link>
                    <p className="font-mono text-xs text-text-muted">{installment.contract.code}</p>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{installment.contract.client.name}</td>
                  <td className="px-3 py-2 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-2"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-2 text-text-secondary"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-2">
                    <InstallmentActions installment={installment} />
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
        onPageChange={setPage}
      />
    </div>
  );
}
