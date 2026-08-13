"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { toastSuccess } from "@/lib/toast";
import type { InvoiceData } from "@/lib/financial/invoice-service";

interface InvoiceViewProps {
  installmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceView({ installmentId, open, onOpenChange }: InvoiceViewProps) {
  const t = useTranslations("financial.receivables.invoice");
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<InvoiceData>({
    queryKey: ["invoice", installmentId],
    queryFn: () => fetchJson<InvoiceData>(`/api/installments/${installmentId}/invoice`),
    enabled: open,
  });

  function handleCopyPix() {
    if (!data?.pixKey) return;
    navigator.clipboard.writeText(data.pixKey).then(() => {
      setCopied(true);
      toastSuccess(t("pixCopied"));
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {isLoading && <LoadingState />}

        {isError && (
          <FinancialErrorState message={t("loadFailed")} onRetry={() => refetch()} />
        )}

        {data && (
          <div className="space-y-4">
            {/* Invoice header */}
            <div className="rounded-lg border border-border bg-page p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{t("contract")}</p>
                  <p className="font-medium">{data.contract.title || data.contract.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-muted">{t("code")}</p>
                  <p className="font-mono text-sm">{data.contract.code}</p>
                </div>
              </div>
            </div>

            {/* Client info */}
            <div className="rounded-lg border border-border bg-page p-4">
              <p className="text-sm text-text-muted">{t("client")}</p>
              <p className="font-medium">{data.client.name}</p>
            </div>

            {/* Amount and due date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-page p-4">
                <p className="text-sm text-text-muted">{t("amount")}</p>
                <p className="text-2xl font-bold text-accent">{data.installment.formattedAmount}</p>
              </div>
              <div className="rounded-lg border border-border bg-page p-4">
                <p className="text-sm text-text-muted">{t("dueDate")}</p>
                <p className="font-medium">{data.installment.dueDate}</p>
              </div>
            </div>

            {/* PIX key section */}
            <div className="rounded-lg border border-border bg-page p-4">
              <p className="text-sm text-text-muted">{t("pixKey")}</p>
              {data.pixKeyConfigured ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-page-alt px-3 py-2 text-sm font-mono break-all">
                      {data.pixKey}
                    </code>
                    <Button
                      size="sm"
                      variant={copied ? "default" : "outline"}
                      onClick={handleCopyPix}
                    >
                      {copied ? t("copied") : t("copyPix")}
                    </Button>
                  </div>
                  <p className="text-xs text-text-muted">{t("pixKeyHint")}</p>
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">{t("noPixKey")}</p>
                  <p className="text-xs text-amber-600 mt-1">{t("noPixKeyHint")}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handlePrint} className="flex-1">
                {t("print")}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("close")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
