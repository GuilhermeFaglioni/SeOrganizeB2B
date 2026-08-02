"use client";

import { useState } from "react";
import { useContractChange } from "@/hooks/use-contracts";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ChangeDialog({
  contractId,
  open,
  onOpenChange,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const change = useContractChange();
  const [type, setType] = useState<"upsell" | "downsell">("upsell");
  const [delta, setDelta] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [strategy, setStrategy] = useState<"redistribute" | "adjust">("redistribute");
  const [proposal, setProposal] = useState<unknown>(null);

  function requestProposal(confirm = false) {
    change.mutate(
      {
        id: contractId,
        type,
        delta,
        effectiveDate,
        description: description || undefined,
        strategy,
        confirm,
      },
      {
        onSuccess: (result) => {
          const data = result as { applied: boolean; proposal?: unknown };
          if (!data.applied) {
            setProposal(data.proposal ?? null);
          } else {
            toastSuccess("Contract value updated");
            setProposal(null);
            onOpenChange(false);
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust contract value</DialogTitle>
          <DialogDescription>
            Review the proposed change before applying it. Paid installments
            are never modified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label htmlFor="change-type" className="text-sm text-text-secondary">
              Type
              <select
                id="change-type"
                value={type}
                onChange={(event) => setType(event.target.value as "upsell" | "downsell")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <option value="upsell">Upsell</option>
                <option value="downsell">Downsell</option>
              </select>
            </label>
            <label htmlFor="change-strategy" className="text-sm text-text-secondary">
              Strategy
              <select
                id="change-strategy"
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as "redistribute" | "adjust")}
                className="ml-2 rounded-md border border-border bg-page px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <option value="redistribute">Redistribute across pending</option>
                <option value="adjust">Additional / negative installment</option>
              </select>
            </label>
          </div>
          <label htmlFor="change-delta" className="block text-sm text-text-secondary">
            Delta (BRL)
            <input
              id="change-delta"
              type="number"
              step="0.01"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
          <label htmlFor="change-effective-date" className="block text-sm text-text-secondary">
            Effective date
            <input
              id="change-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
          <label htmlFor="change-description" className="block text-sm text-text-secondary">
            Description
            <input
              id="change-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
          {proposal !== null && (
            <div className="rounded-md bg-bg-secondary p-3 text-sm text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">Proposed result</p>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(proposal, null, 2)}</pre>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!proposal && (
            <Button
              disabled={!delta || !effectiveDate}
              onClick={() => requestProposal(false)}
            >
              Preview proposal
            </Button>
          )}
          {proposal !== null && (
            <Button onClick={() => requestProposal(true)}>Confirm and apply</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
