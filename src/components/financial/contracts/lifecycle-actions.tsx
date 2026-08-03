"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useContractLifecycle } from "@/hooks/use-contracts";
import { useCan } from "@/hooks/use-permissions";
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
  const t = useTranslations("financial.contracts.lifecycle");
  const lifecycle = useContractLifecycle();
  const { can } = useCan();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");

  const ACTION_TOAST_KEYS: Record<string, string> = {
    activate: "actionActivated",
    suspend: "actionSuspended",
    resume: "actionResumed",
    close: "actionClosed",
    renew: "actionRenewed",
    cancel: "actionCancelled",
  };

  function run(action: string, extra: Record<string, unknown> = {}) {
    lifecycle.mutate(
      { id: contractId, action, ...extra },
      {
        onSuccess: () => {
          toastSuccess(t(ACTION_TOAST_KEYS[action] ?? "actionApplied"));
          router.refresh();
        },
      }
    );
  }

  if (!can("financial.contracts.lifecycle")) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <Button
          onClick={() => run("activate", { plan })}
          disabled={!plan || plan.length === 0}
        >
          {t("actionActivate")}
        </Button>
      )}
      {status === "active" && (
        <Button variant="outline" onClick={() => run("suspend")}>
          {t("actionSuspend")}
        </Button>
      )}
      {status === "suspended" && (
        <Button variant="outline" onClick={() => run("resume")}>
          {t("actionResume")}
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("close")}>
          {t("actionClose")}
        </Button>
      )}
      {(status === "active" || status === "suspended") && (
        <Button variant="outline" onClick={() => run("renew")}>
          {t("actionRenew")}
        </Button>
      )}
      {(status === "active" || status === "suspended" || status === "draft") && (
        <Button variant="destructive" onClick={() => setCancelOpen(true)}>
          {t("actionCancel")}
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>
              {t("cancelDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="cancel-date" className="text-sm text-text-secondary">
              {t("cancelEffectiveDate")}
            </label>
            <input
              id="cancel-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {t("keepContract")}
            </Button>
            <Button
              variant="destructive"
              disabled={!effectiveDate}
              onClick={() => {
                run("cancel", { effectiveDate, retainedInstallmentIds: [] });
                setCancelOpen(false);
              }}
            >
              {t("confirmCancellation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
