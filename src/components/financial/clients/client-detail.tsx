"use client";

import { useClient, useDeactivateClient } from "@/hooks/use-clients";
import { toDecimal, sum } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

interface ClientContract {
  id: string;
  code: string;
  title: string;
  status: string;
  officialValue: string;
  startDate: string;
  endDate: string | null;
  _count?: { projects: number };
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const { data: client, isLoading, isError, refetch } = useClient(clientId);
  const deactivate = useDeactivateClient();

  if (isLoading) return <LoadingState />;
  if (isError || !client) {
    return (
      <FinancialErrorState
        message="Failed to load the client"
        onRetry={() => refetch()}
      />
    );
  }

  const contracts = (client.contracts ?? []) as ClientContract[];
  const revenue = sum(
    contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => toDecimal(contract.officialValue))
  );
  const activeProjects = contracts.reduce(
    (acc, contract) => acc + (contract._count?.projects ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {client.name}
          </h1>
          {client.legalName && (
            <p className="text-sm text-text-secondary">{client.legalName}</p>
          )}
          <p className="mt-1 text-sm text-text-muted">
            {client.cpfCnpj ?? "\u2014"} &middot; {client.email ?? "\u2014"}{" "}
            &middot; {client.phone ?? "\u2014"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              deactivate.mutate(client.id, {
                onSuccess: () => toastSuccess("Client deactivated"),
              })
            }
            disabled={!client.active}
          >
            {client.active ? "Deactivate" : "Inactive"}
          </Button>
        </div>
      </div>

      <section
        aria-labelledby="client-summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Contracts</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {contracts.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">
            Active contracted value
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            <MoneyText value={revenue.toFixed(2)} />
          </p>
        </div>
        <div className="rounded-xl border border-border bg-page-alt p-4">
          <p className="text-sm text-text-secondary">Linked projects</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {activeProjects}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="client-history"
        className="rounded-xl border border-border bg-page-alt p-4"
      >
        <h2
          id="client-history"
          className="mb-3 text-base font-semibold text-text-primary"
        >
          Contract and revenue history
        </h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-text-muted">
            No contracts recorded for this client.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-3 py-1 font-medium">
                    Title
                  </th>
                  <th scope="col" className="px-3 py-1 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-1 font-medium">
                    Official value
                  </th>
                  <th scope="col" className="px-3 py-1 font-medium">
                    Period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-3 py-1 font-mono text-xs text-text-secondary">
                      {contract.code}
                    </td>
                    <td className="px-3 py-1 font-medium">{contract.title}</td>
                    <td className="px-3 py-1">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-3 py-1 font-medium">
                      <MoneyText value={contract.officialValue} />
                    </td>
                    <td className="px-3 py-1 text-text-secondary">
                      <CivilDateText date={contract.startDate} /> &mdash;{" "}
                      <CivilDateText date={contract.endDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
