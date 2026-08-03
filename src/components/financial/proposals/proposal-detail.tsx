"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useCloneProposal,
  useDeleteProposal,
  useProposal,
  useRejectProposal,
  useSendProposal,
} from "@/hooks/use-proposals";
import { toastSuccess } from "@/lib/toast";
import { MoneyText } from "@/components/financial/shared/money-text";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { ProposalStatusBadge } from "@/components/financial/proposals/proposal-status-badge";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { ProposalHtmlPreview } from "@/components/financial/proposals/proposal-html-preview";
import { Clipboard, ExternalLink, Trash2 } from "lucide-react";

export function ProposalDetail({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const t = useTranslations("proposals.detail");
  const { data: proposal, isLoading, isError, refetch } = useProposal(proposalId);
  const sendProposal = useSendProposal();
  const cloneProposal = useCloneProposal();
  const deleteProposal = useDeleteProposal();
  const rejectProposal = useRejectProposal();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const publicUrl = useMemo(
    () =>
      typeof window !== "undefined" && proposal?.token
        ? `${window.location.origin}/p/${proposal.token}`
        : null,
    [proposal]
  );

  useEffect(() => {
    setRejectOpen(false);
    setRejectReason("");
  }, [proposalId]);

  if (isLoading) return <LoadingState />;
  if (isError || !proposal) {
    return (
      <FinancialErrorState
        message={t("loadFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  const isDraft = proposal.status === "draft";
  const isOpen = proposal.status === "sent" || proposal.status === "viewed";

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toastSuccess(t("linkCopied"));
    } catch {
      toastSuccess(publicUrl);
    }
  };

  const handleSend = () => {
    sendProposal.mutate(proposal.id, {
      onSuccess: () => toastSuccess(t("sent")),
    });
  };

  const handleClone = () => {
    cloneProposal.mutate(proposal.id, {
      onSuccess: (cloned) => {
        toastSuccess(t("cloned"));
        router.push(`/financial/proposals/${(cloned as { id: string }).id}`);
      },
    });
  };

  const handleDelete = () => {
    if (!window.confirm(t("confirmDelete", { code: proposal.code }))) return;
    deleteProposal.mutate(proposal.id, {
      onSuccess: () => {
        toastSuccess(t("deleted"));
        router.push("/financial/proposals");
      },
    });
  };

  const handleReject = () => {
    rejectProposal.mutate(
      { id: proposal.id, reason: rejectReason || undefined },
      {
        onSuccess: () => {
          toastSuccess(t("rejected"));
          setRejectOpen(false);
          setRejectReason("");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-text-muted">{proposal.code}</p>
          <h1 className="text-xl font-semibold text-text-primary">{proposal.title}</h1>
          <p className="text-sm text-text-secondary">
            {proposal.client?.name ?? "—"} · {proposal.template?.name ?? t("noTemplate")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProposalStatusBadge status={proposal.status} />
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <>
                <Link
                  href={`/financial/proposals/${proposal.id}/edit`}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  {t("edit")}
                </Link>
                <Button onClick={handleSend}>{t("send")}</Button>
              </>
            )}
            {publicUrl && (
              <>
                <Button variant="outline" onClick={copyLink}>
                  <Clipboard size={16} aria-hidden="true" /> {t("copyLink")}
                </Button>
                <Link
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ExternalLink size={16} aria-hidden="true" /> {t("viewPublic")}
                </Link>
              </>
            )}
            {isOpen && (
              <Button variant="outline" onClick={() => setRejectOpen((open) => !open)}>
                {t("reject")}
              </Button>
            )}
            <Button variant="outline" onClick={handleClone}>
              {t("clone")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 size={16} aria-hidden="true" /> {t("delete")}
            </Button>
          </div>
        </div>
      </div>

      {rejectOpen && (
        <div className="rounded-xl border border-border bg-page-alt p-4 space-y-3">
          <Label htmlFor="reject-reason">{t("rejectReasonLabel")}</Label>
          <Input
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder={t("rejectReasonPlaceholder")}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              {t("confirmReject")}
            </Button>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{t("detailsTitle")}</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4" aria-label={t("detailsAria")}>
          <div>
            <dt className="text-xs text-text-muted">{t("totalValue")}</dt>
            <dd className="font-semibold text-text-primary">
              {proposal.totalValue ? <MoneyText value={proposal.totalValue} /> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("issueDate")}</dt>
            <dd className="text-text-primary"><CivilDateText date={proposal.issueDate} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("validUntil")}</dt>
            <dd className="text-text-primary"><CivilDateText date={proposal.validUntil} /></dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t("viewedAt")}</dt>
            <dd className="text-text-primary"><CivilDateText date={proposal.viewedAt} /></dd>
          </div>
        </dl>
        {proposal.status === "accepted" && (
          <p className="mt-4 text-sm text-success">
            {t("acceptedBy", {
              name: proposal.acceptedByName ?? "—",
              date: proposal.acceptedAt ?? "—",
            })}
          </p>
        )}
        {proposal.status === "rejected" && (
          <p className="mt-4 text-sm text-danger">
            {t("rejectedAt", { date: proposal.rejectedAt ?? "—" })}
            {proposal.rejectedReason ? ` — ${proposal.rejectedReason}` : ""}
          </p>
        )}
      </section>

      {proposal.items.length > 0 && (
        <section className="rounded-xl border border-border bg-page-alt p-4">
          <h2 className="mb-3 text-base font-semibold text-text-primary">{t("itemsTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm" aria-label={t("itemsAria")}>
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemName")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemQuantity")}</th>
                  <th scope="col" className="px-3 py-1 font-medium">{t("itemPrice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proposal.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1 font-medium">{item.name}</td>
                    <td className="px-3 py-1">{item.quantity ?? "—"}</td>
                    <td className="px-3 py-1">{item.price ? <MoneyText value={item.price} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-page-alt p-4">
        <h2 className="mb-3 text-base font-semibold text-text-primary">{t("previewTitle")}</h2>
        {proposal.htmlSnapshot ? (
          <ProposalHtmlPreview html={proposal.htmlSnapshot} className="h-[500px]" />
        ) : (
          <p className="text-sm text-text-muted">{t("previewEmpty")}</p>
        )}
      </section>
    </div>
  );
}
