export function FinancialEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
