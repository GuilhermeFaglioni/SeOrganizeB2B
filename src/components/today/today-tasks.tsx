"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckSquare2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTodayTasks } from "@/hooks/use-today";
import { LoadingState } from "@/components/shared/loading-state";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { Button } from "@/components/ui/button";

export function TodayTasks() {
  const t = useTranslations("today.tasks");
  const router = useRouter();
  const { data = [], isLoading, error, refetch } = useTodayTasks();

  return (
    <section className="rounded-2xl border border-border bg-page-alt p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare2 className="h-4 w-4 text-accent" />
        <h3 className="text-heading-1 text-text-primary">{t("heading")}</h3>
        <span className="ml-auto text-xs text-text-secondary">{data.length}</span>
      </div>
      {isLoading && <LoadingState />}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-danger-bg p-3 text-sm text-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {t("loadFailed")}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {!isLoading && !error && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-text-secondary">{t("empty")}</p>
          <Link
            href="/projects"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {t("emptyAction")}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            projectName={task.project.name}
            onClick={() => router.push(`/board?project=${task.project.id}`)}
          />
        ))}
      </div>
    </section>
  );
}
