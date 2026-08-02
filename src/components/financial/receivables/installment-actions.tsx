"use client";

import { useState } from "react";
import {
  useCancelInstallment,
  useMarkInstallmentPaid,
  useRefundInstallment,
} from "@/hooks/use-installments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const markPaid = useMarkInstallmentPaid();
  const cancel = useCancelInstallment();
  const refund = useRefundInstallment();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState("");

  if (installment.status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            markPaid.mutate({
              id: installment.id,
              paidAt: new Date().toISOString().slice(0, 10),
            })
          }
        >
          Mark paid
        </Button>
        <Button size="sm" variant="outline" onClick={() => cancel.mutate(installment.id)}>
          Cancel
        </Button>
      </div>
    );
  }

  if (installment.status === "paid") {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
          Refund
        </Button>
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record refund</DialogTitle>
              <DialogDescription>
                The refund creates a negative paid installment linked to the
                original one and subtracts from received revenue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm text-text-secondary">
                Refund amount (BRL)
                <input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-text-secondary">
                Refund date
                <input
                  type="date"
                  value={refundDate}
                  onChange={(event) => setRefundDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOpen(false)}>
                Close
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
                Confirm refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
