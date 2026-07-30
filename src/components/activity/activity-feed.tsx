"use client";

import { Activity, AlertCircle } from "lucide-react";
import { useActivity } from "@/hooks/use-activity";
import { LoadingState } from "@/components/shared/loading-state";

export function ActivityFeed({
  taskId,
  limit = 20,
}: {
  taskId?: string;
  limit?: number;
}) {
  const { data = [], isLoading, error, refetch } = useActivity(taskId, limit);
  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <button
        className="flex items-center gap-2 text-sm text-danger"
        onClick={() => refetch()}
      >
        <AlertCircle className="h-4 w-4" /> Falha ao carregar atividade.
      </button>
    );
  }
  if (!data.length) {
    return <p className="text-sm text-text-secondary">Sem atividade ainda.</p>;
  }
  return (
    <ol className="space-y-3" aria-live="polite">
      {data.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-text-primary">{item.summary}</p>
            <p className="text-xs text-text-secondary">
              {item.actor?.name || "Sistema"} ·{" "}
              {new Date(item.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
