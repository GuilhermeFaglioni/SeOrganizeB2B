"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useDeleteProposal,
  useProposals,
  type ProposalListFilters,
} from "@/hooks/use-proposals";
import { useCan } from "@/hooks/use-permissions";
import { toastSuccess } from "@/lib/toast";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { ProposalStatusBadge } from "@/components/financial/proposals/proposal-status-badge";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

const STATUS_FILTERS = ["", "draft", "sent", "viewed", "accepted", "rejected"];

export function ProposalList() {
  const router = useRouter();
  const t = useTranslations("proposals.list");
  const [filters, setFilters] = useState<ProposalListFilters>({
    page: 1,
    pageSize: 25,
  });
  const { data, isLoading, isError, refetch } = useProposals(filters);
  const deleteProposal = useDeleteProposal();
  const { can } = useCan();

  function handleDelete(proposal: { id: string; title: string }) {
    if (
      !window.confirm(
        t("confirmDelete", { title: proposal.title })
      )
    ) {
      return;
    }
    deleteProposal.mutate(proposal.id, {
      onSuccess: () => toastSuccess(t("deleted")),
    });
  }

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return (
      <FinancialErrorState
        message={t("loadFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="search" aria-label={t("searchLabel")}>
            <input
              value={filters.search ?? ""}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value, page: 1 })
              }
              placeholder={t("searchPlaceholder")}
              className="rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </div>
          <select
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value || undefined, page: 1 })
            }
            aria-label={t("statusFilterLabel")}
            className="rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status
                  ? t(`statuses.${status}`)
                  : t("allStatuses")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {can("financial.proposals.manageTemplates") && (
            <Link
              href="/financial/proposals/templates"
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-medium text-text-secondary hover:bg-page focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <FileText size={16} aria-hidden="true" /> {t("templates")}
            </Link>
          )}
          {can("financial.proposals.create") && (
            <Link
              href="/financial/proposals/new"
              className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Plus size={16} aria-hidden="true" /> {t("newProposal")}
            </Link>
          )}
        </div>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState
          title={t("emptyTitle")}
          hint={filters.search ? t("emptyHintSearch", { search: filters.search }) : t("emptyHint")}
          action={
            !filters.search && can("financial.proposals.create")
              ? { label: t("emptyAction"), href: "/financial/proposals/new" }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt" aria-live="polite">
          <table className="w-full min-w-[760px] text-left text-sm" aria-label={t("tableLabel")}>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t("colCode")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colTitle")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colClient")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colStatus")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colValue")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colCreated")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((proposal) => (
                <tr key={proposal.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{proposal.code}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/financial/proposals/${proposal.id}`)}
                      className="font-medium text-text-primary hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {proposal.title}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{proposal.client?.name ?? "—"}</td>
                  <td className="px-3 py-2"><ProposalStatusBadge status={proposal.status} /></td>
                  <td className="px-3 py-2 font-medium">
                    {proposal.totalValue ? <MoneyText value={proposal.totalValue} /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    <CivilDateText date={proposal.createdAt.slice(0, 10)} />
                  </td>
                  <td className="px-3 py-2">
                    {can("financial.proposals.delete") && (
                      <button
                        type="button"
                        onClick={() => handleDelete(proposal)}
                        aria-label={`${t("deleteAria")} ${proposal.code}`}
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
