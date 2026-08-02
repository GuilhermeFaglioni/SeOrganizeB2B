"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useContract, useDeleteContract } from "@/hooks/use-contracts";
import { useMarkInstallmentPaid } from "@/hooks/use-installments";
import { suggestPlan } from "@/lib/financial/installments";
import { toDecimal } from "@/lib/financial/money";
import { toastSuccess } from "@/lib/toast";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { StatusBadge } from "@/components/financial/shared/status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { LifecycleActions } from "@/components/financial/contracts/lifecycle-actions";
import { ChangeDialog } from "@/components/financial/contracts/change-dialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { Trash2 } from "lucide-react";

export function ContractDetail({ contractId }: { contractId: string }) {
  const router = useRouter();
  const t = useTranslations("financial.contracts.detail");
  const { data: contract, isLoading, isError, refetch } = useContract(contractId);
  const markPaid = useMarkInstallmentPaid();
  const deleteContract = useDeleteContract();
  const [changeOpen, setChangeOpen] = useState(false);

  function handleDelete() {
    if (
      !window.confirm(
        t("confirmDeleteDetail")
      )
    ) {
      return;
    }
    deleteContract.mutate(contract!.id, {
      onSuccess: () => {
        toastSuccess(t("contractDeletedDetail"));
        router.push("/financial/contracts");
      },
    });
  }

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
    return <FinancialErrorState message={t("loadFailedDetail")} onRetry={() => refetch()} />;
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
            {(contract.status === "draft" || contract.status === "active") && (
              <Link
                href={`/financial/contracts/${contract.id}/edit`}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-page hover:text-text-primary min-h-[44px] md:min-h-[36px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {t("edit")}
              </Link>
            )}
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => setChangeOpen(true)}>
                {t("adjustValue")}
              </Button>
            )}
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 size={16} aria-hidden="true" /> {t("delete")}
            </Button>
          </div>
        </div>
      </div>

      <section aria-labelledby="commercial-summary" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="commercial-summary" className="mb-3 text-base font-semibold text-text-primary">
          {t("commercialSummary")}
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4" aria-label={t("commercialSummaryAria")}>
          <div>
            <dt className="text-xs text-text-muted">{t("officialValue")}</dt>
            <dd className="font-semibold text-text-primary"><MoneyText value={contract.officialValue} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("duration")}</dt>
            <dd className="text-text-primary">{contract.durationType}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("startDate")}</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.startDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("endDate")}</dt>
            <dd className="text-text-primary"><CivilDateText date={contract.endDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("billingFrequency")}</dt>
            <dd className="text-text-primary">{contract.billingFrequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("paymentMethod")}</dt>
            <dd className="text-text-primary">{contract.paymentMethod}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="items-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="items-title" className="mb-3 text-base font-semibold text-text-primary">{t("itemsTitle")}</h2>
        {contract.items.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noItems")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm" aria-label={t("itemsAria")}>
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemName")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemQuantity")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemUnit")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemPrice")}</th>
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
        <h2 id="projects-title" className="mb-3 text-base font-semibold text-text-primary">{t("linkedProjects")}</h2>
        {contract.projects.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noLinkedProjects")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label={t("linkedProjectsAria")}>
            {contract.projects.map((link) => (
              <li key={link.project.id} className="rounded-md bg-bg-secondary px-3 py-1 text-sm text-text-secondary">
                {link.project.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="installments-title" className="rounded-xl border border-border bg-page-alt p-4">
        <h2 id="installments-title" className="mb-3 text-base font-semibold text-text-primary">{t("installments")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm" aria-label={t("installmentsAria")}>
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th scope="col" className="px-3 py-1 font-medium">{t("dueDate")}</th>
                <th scope="col" className="px-3 py-1 font-medium">{t("amount")}</th>
                <th scope="col" className="px-3 py-1 font-medium">{t("status")}</th>
                <th scope="col" className="px-3 py-1 font-medium">{t("paidDate")}</th>
                <th scope="col" className="px-3 py-1 font-medium">{t("paymentMethod")}</th>
                <th scope="col" className="px-3 py-1 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contract.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-1"><CivilDateText date={installment.dueDate} /></td>
                  <td className="px-3 py-1 font-medium">
                    <MoneyText value={installment.expectedAmount} />
                    {installment.refundOfId && (
                      <span className="ml-1 text-xs text-text-muted">{t("refund")}</span>
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
                        className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      >
                        {t("markPaid")}
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
          <h2 id="changes-title" className="mb-3 text-base font-semibold text-text-primary">{t("changesTitle")}</h2>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm" aria-label={t("changesAria")}>
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changeType")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changeDelta")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changeEffective")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changePrevious")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changeNew")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("changeReason")}</th>
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
          <h2 id="audit-title" className="mb-3 text-base font-semibold text-text-primary">{t("auditTitle")}</h2>
          <ul className="divide-y divide-border text-sm" aria-label={t("auditAria")}>
            {contract.audits.map((audit) => (
              <li key={audit.id} className="py-2">
                <p className="text-text-primary">
                  <span className="font-medium">{audit.field}</span> {t("auditChanged")}
                  {audit.reason ? ` — ${audit.reason}` : ""}
                </p>
                <p className="text-xs text-text-muted">
                  {audit.actor?.name ?? t("auditSystem")} · {new Date(audit.createdAt).toLocaleString()}
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
