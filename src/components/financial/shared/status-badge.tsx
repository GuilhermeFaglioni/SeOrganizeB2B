import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  draft: "bg-bg-secondary text-text-secondary",
  active: "bg-success-bg text-success",
  closed: "bg-bg-secondary text-text-secondary",
  cancelled: "bg-danger-bg text-danger",
  suspended: "bg-warning-bg text-warning",
  pending: "bg-warning-bg text-warning",
  paid: "bg-success-bg text-success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status] ?? "bg-bg-secondary text-text-secondary"
      )}
    >
      {status}
    </span>
  );
}
