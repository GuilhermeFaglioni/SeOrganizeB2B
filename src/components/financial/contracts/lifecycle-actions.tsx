"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContractLifecycle } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import type { InstallmentPlanItem } from "@/lib/financial/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LifecycleActions({
  contractId,
  status,
  plan,
}: {
  contractId: string;
  status: string;
  plan?: InstallmentPlanItem[];
}) {
  const router = useRouter();
  const lifecycle = useContractLifecycle();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");

  function run(action: string, extra: Record<string, unknown> = {}) {
    lifecycle.mutate(
      { id: contractId, action, ...extra },
      {
        onSuccess: () => {
          toastSuccess(`Contract ${action.replace("_", " ")}`);
          router.refresh();
        },
      }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <Button
          onClick={() => run("activate", { plan })}
          disabled={!plan || plan.length === 0}
        >
          Activate
        </Button>
      )}
      {status === "active" && (
        <Button variant="outline" onClick={() => run("suspend")}>
          Suspend
        </Button>
      )}
      {status === "suspended" && (
        <Button variant="outline" onClick={() => run("resume")}>
          Resume
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("close")}>
          Close
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("renew")}>
          Renew
        </Button>
      )}
      {(status === "active" || status === "suspended" || status === "draft") && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          Cancel
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel contract</DialogTitle>
            <DialogDescription>
              Future installments after the effective date will be cancelled.
              Paid and already overdue installments remain collectible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="cancel-date" className="text-sm text-text-secondary">
              Effective date
            </label>
            <input
              id="cancel-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep contract
            </Button>
            <Button
              variant="destructive"
              disabled={!effectiveDate}
              onClick={() => {
                run("cancel", { effectiveDate, retainedInstallmentIds: [] });
                setCancelOpen(false);
              }}
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
