"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-bg-secondary text-text-secondary",
  sent: "bg-warning-bg text-warning",
  viewed: "bg-info-bg text-info",
  accepted: "bg-success-bg text-success",
  rejected: "bg-danger-bg text-danger",
};

export function ProposalStatusBadge({ status }: { status: string }) {
  const t = useTranslations("proposals.statuses");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status] ?? "bg-bg-secondary text-text-secondary"
      )}
    >
      {t(status, { defaultValue: status })}
    </span>
  );
}
