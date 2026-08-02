"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Pagination } from "@/components/financial/contracts/pagination";
import { LoadingState } from "@/components/shared/loading-state";

export function ClientList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useClients({
    search: query || undefined,
    page,
    pageSize: 25,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return (
      <FinancialErrorState
        message="Failed to load clients"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="client-search" className="sr-only">
            Search clients
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
            placeholder="Search by name, email or CPF/CNPJ"
            className="w-64 rounded-md border border-border bg-page-alt px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setQuery(search.trim());
              setPage(1);
            }}
            className="flex min-h-[44px] items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
            aria-label="Search clients"
          >
            <Search size={16} aria-hidden="true" />
          </button>
        </div>
        <Link
          href="/financial/clients/new"
          className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} aria-hidden="true" /> New client
        </Link>
      </div>

      {data.items.length === 0 ? (
        <FinancialEmptyState title="No clients match your search" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-page-alt">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="border-b border-border text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Name
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  CPF/CNPJ
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Email
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Phone
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Contracts
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((client) => (
                <tr key={client.id} className="hover:bg-bg-secondary">
                  <td className="px-3 py-2">
                    <Link
                      href={`/financial/clients/${client.id}`}
                      className="font-medium text-text-primary hover:text-accent"
                    >
                      {client.name}
                    </Link>
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
