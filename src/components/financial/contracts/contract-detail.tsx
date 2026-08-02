"use client";

import { useMemo, useState } from "react";
import { useContract } from "@/hooks/use-contracts";
import { useMarkInstallmentPaid } from "@/hooks/use-installments";
import { suggestPlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { LifecycleActions } from "@/components/financial/contracts/lifecycle-actions";
import { ChangeDialog } from "@/components/financial/contracts/change-dialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export function ContractDetail({ contractId }: { contractId: string }) {
  const { data: contract, isLoading, isError, refetch } = useContract(contractId);
  const markPaid = useMarkInstallmentPaid();
  const [changeOpen, setChangeOpen] = useState(false);

  const activationPlan = useMemo(() => {
    if (!contract) return [];
    try {
      return suggestPlan(
        toDecimal(contract.officialValue),
        contract.durationType,
        contract.startDate,
        contract.endDate,
        contract.billingFrequency,
        contract.paymentMethod as never
      );
    } catch {
      return [];
    }
  }, [contract]);

  if (isLoading) return <LoadingState />;
  if (isError || !contract) {
    return <FinancialErrorState message="Failed to load the contract" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">{contract.code}</p>
          <h1 className="text-xl font-semibold text-text-primary">{contract.title}</h1>
          <p className="text-sm text-text-secondary">{contract.client.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={contract.status} />
          <div className="flex flex-wrap gap-2">
            <LifecycleActions
              contractId={contract.id}
              status={contract.status}
              plan={activationPlan}
            />
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => setChangeOpen(true)}>
                Adjust value
              </Button>
            )}
          </div>
        </div>
      </div>

      <section aria-labelledby="commercial-summary" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="commercial-summary" className="mb-3 text-base font-semibold text-text-primary">
          Commercial summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Official value</dt>
            <dd className="font-semibold text-text-primary"><MoneyText value={contract.officialValue} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Duration</dt>
            <dd className="text-text-primary">{contract.durationType}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Start</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.startDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">End</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.endDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Billing frequency</dt>
            <dd className="text-text-primary">{contract.billingFrequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Payment method</dt>
            <dd className="text-text-primary">{contract.paymentMethod}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="items-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="items-title" className="mb-3 text-base font-semibold text-text-primary">Items</h2>
        {contract.items.length === 0 ? (
          <p className="text-sm text-text-muted">No items recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Name</th>
                  <th scope="col" className="px-3 py-1 font-medium">Quantity</th>
                  <th scope="col" className="px-3 py-1 font-medium">Unit</th>
                  <th scope="col" className="px-3 py-1 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1 font-medium">{item.name}</td>
                    <td className="px-3 py-1">{item.quantity ?? "—"}</td>
                    <td className="px-3 py-1">{item.unit ?? "—"}</td>
                    <td className="px-3 py-1">{item.price ? <MoneyText value={item.price} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="projects-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="projects-title" className="mb-3 text-base font-semibold text-text-primary">Linked projects</h2>
        {contract.projects.length === 0 ? (
          <p className="text-sm text-text-muted">No linked projects.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {contract.projects.map((link) => (
              <li key={link.project.id} className="rounded-md bg-bg-secondary px-3 py-1 text-sm text-text-secondary">
                {link.project.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="installments-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="installments-title" className="mb-3 text-base font-semibold text-text-primary">Installments</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-1 font-medium">Due date</th>
                <th scope="col" className="px-3 py-1 font-medium">Amount</th>
                <th scope="col" className="px-3 py-1 font-medium">Status</th>
                <th scope="col" className="px-3 py-1 font-medium">Paid date</th>
                <th scope="col" className="px-3 py-1 font-medium">Payment method</th>
                <th scope="col" className="px-3 py-1 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contract.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-1"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-1 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">refund</span>
                    )}
                  </td>
                  <td className="px-3 py-1"><StatusBadge status={installment.status} /></td>
                  <td className="px-3 py-1"><CivilDateText date={installment.paidAt} /></td>
                  <td className="px-3 py-1">{installment.paymentMethod}</td>
                  <td className="px-3 py-1">
                    {installment.status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          markPaid.mutate({
                            id: installment.id,
                            paidAt: new Date().toISOString().slice(0, 10),
                          })
                        }
                        className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {contract.changes.length > 0 && (
        <section aria-labelledby="changes-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="changes-title" className="mb-3 text-base font-semibold text-text-primary">Upsell and downsell history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">Type</th>
                  <th scope="col" className="px-3 py-1 font-medium">Delta</th>
                  <th scope="col" className="px-3 py-1 font-medium">Effective</th>
                  <th scope="col" className="px-3 py-1 font-medium">Previous</th>
                  <th scope="col" className="px-3 py-1 font-medium">New</th>
                  <th scope="col" className="px-3 py-1 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contract.changes.map((change) => (
                  <tr key={change.id}>
                    <td className="px-3 py-1 capitalize">{change.type}</td>
                    <td className="px-3 py-1 font-medium"><MoneyText value={change.delta} /></td>
                    <td className="px-3 py-1"><CivilDateText date={change.effectiveDate} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.previousValue} /></td>
                    <td className="px-3 py-1"><MoneyText value={change.newValue} /></td>
                    <td className="px-3 py-1 text-text-secondary">{change.reason ?? change.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {contract.audits.length > 0 && (
        <section aria-labelledby="audit-title" className="rounded-xl border border-border bg-page-alt p-4">
          <h2 id="audit-title" className="mb-3 text-base font-semibold text-text-primary">Audit history</h2>
          <ul className="divide-y divide-border text-sm">
            {contract.audits.map((audit) => (
              <li key={audit.id} className="py-2">
                <p className="text-text-primary">
                  <span className="font-medium">{audit.field}</span> changed
                  {audit.reason ? ` — ${audit.reason}` : ""}
                </p>
                <p className="text-xs text-text-muted">
                  {audit.actor?.name ?? "System"} · {new Date(audit.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChangeDialog contractId={contract.id} open={changeOpen} onOpenChange={setChangeOpen} />
    </div>
  );
}
