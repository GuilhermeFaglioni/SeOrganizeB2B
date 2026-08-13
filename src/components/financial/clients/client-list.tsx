"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { useCan } from "@/hooks/use-permissions";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "inactive"];

export function ClientList() {
  const t = useTranslations("financial.clients.list");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [page, setPage] = useState(1);
  const { can } = useCan();

  const apiActive: true | false | "all" =
    statusFilter === "active" ? true : statusFilter === "inactive" ? false : "all";

  const { data, isLoading, isError, refetch } = useClients({
    search: query || undefined,
    page,
    pageSize: 25,
    active: apiActive,
  });

  const statusLabels: Record<StatusFilter, string> = {
    all: t("filterAll"),
    active: t("filterActive"),
    inactive: t("filterInactive"),
  };

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
        <div className="flex flex-wrap items-center gap-2" role="search" aria-label={t("searchFiltersLabel")}>
          <label htmlFor="client-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setQuery(search.trim());
                setPage(1);
              }
            }}
            placeholder={t("searchPlaceholder")}
            className="w-64 rounded-md border border-border bg-page-alt px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setQuery(search.trim());
              setPage(1);
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            aria-label={t("searchLabel")}
          >
            <Search size={16} aria-hidden="true" />
          </button>
          <div role="radiogroup" aria-label={t("filterStatusLabel")} className="flex items-center gap-1">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={statusFilter === value}
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={cn(
                  "flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                  statusFilter === value
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-bg-secondary"
                )}
              >
                {statusLabels[value]}
              </button>
            ))}
          </div>
        </div>
        {can("financial.clients.create") && (
          <Link
            href="/financial/clients/new"
            className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Plus size={16} aria-hidden="true" /> {t("newClient")}
          </Link>
        )}
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState
          title={
            statusFilter === "inactive"
              ? t("noInactiveClients")
              : query
                ? t("noSearchMatches")
                : t("emptyTitle")
          }
          hint={!query && statusFilter !== "inactive" ? t("emptyHint") : undefined}
          action={
            !query && statusFilter !== "inactive" && can("financial.clients.create")
              ? { label: t("emptyAction"), href: "/financial/clients/new" }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt" aria-live="polite">
          <table className="w-full min-w-[640px] text-left text-sm" aria-label={t("tableLabel")}>
            <caption className="sr-only">{t("tableLabel")}</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("name")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("cpfCnpj")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("email")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("phone")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("contracts")}
                </th>
                {statusFilter === "all" && (
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("status")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((client) => (
                <tr
                  key={client.id}
                  className={cn(
                    "hover:bg-bg-secondary",
                    !client.active && "opacity-60"
                  )}
                  aria-label={!client.active ? t("inactiveRow", { name: client.name }) : undefined}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/clients/${client.id}`}
                      className="font-medium text-text-primary hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {client.name}
                    </Link>
                    {!client.active && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-muted">
                        {t("inactive")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {client.cpfCnpj ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {client.email ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {client.phone ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {client._count?.contracts ?? 0}
                  </td>
                  {statusFilter === "all" && (
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          client.active
                            ? "bg-success-bg text-success"
                            : "bg-bg-secondary text-text-muted"
                        )}
                      >
                        {client.active ? t("active") : t("inactive")}
                      </span>
                    </td>
                  )}
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
