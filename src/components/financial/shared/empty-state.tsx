import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface FinancialEmptyStateProps {
  title: string;
  hint?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function FinancialEmptyState({ title, hint, action }: FinancialEmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-3 flex min-h-[44px] items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {action.label}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
