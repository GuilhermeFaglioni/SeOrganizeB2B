"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useCancelInstallment,
  useMarkInstallmentPaid,
  useRefundInstallment,
} from "@/hooks/use-installments";
import { useCan } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceView } from "@/components/financial/receivables/invoice-view";

export function InstallmentActions({
  installment,
}: {
  installment: {
    id: string;
    status: string;
    expectedAmount: string;
    dueDate: string;
  };
}) {
  const t = useTranslations("financial.receivables.installmentActions");
  const markPaid = useMarkInstallmentPaid();
  const cancel = useCancelInstallment();
  const refund = useRefundInstallment();
  const { can } = useCan();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  if (installment.status === "pending") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
            {t("generateInvoice")}
          </Button>
          {can("financial.receivables.markPaid") && (
            <Button
              size="sm"
              onClick={() =>
                markPaid.mutate({
                  id: installment.id,
                  paidAt: new Date().toISOString().slice(0, 10),
                })
              }
            >
              {t("markPaid")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => cancel.mutate(installment.id)}>
            {t("cancel")}
          </Button>
        </div>
        <InvoiceView
          installmentId={installment.id}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      </>
    );
  }

  if (installment.status === "paid") {
    return (
      <>
        {can("financial.receivables.refund") && (
          <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
            {t("refund")}
          </Button>
        )}
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("recordRefund")}</DialogTitle>
              <DialogDescription>
                {t("refundDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label htmlFor="refund-amount" className="block text-sm text-text-secondary">
                {t("refundAmountField")}
                <input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
              </label>
              <label htmlFor="refund-date" className="block text-sm text-text-secondary">
                {t("refundDateField")}
                <input
                  id="refund-date"
                  type="date"
                  value={refundDate}
                  onChange={(event) => setRefundDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>
                {t("close")}
              </Button>
              <Button
                disabled={!refundAmount || !refundDate}
                onClick={() =>
                  refund.mutate(
                    {
                      id: installment.id,
                      refundAmount,
                      refundDate,
                    },
                    { onSuccess: () => setRefundOpen(false) }
                  )
                }
              >
                {t("confirmRefund")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
