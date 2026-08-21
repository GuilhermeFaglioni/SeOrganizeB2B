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
    <section className="balsa-surface rounded-balsa-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <CheckSquare2 className="h-4 w-4 text-balsa-primary" />
        <h3 className="font-balsa-title text-lg font-semibold text-balsa-foreground">{t("heading")}</h3>
        <span className="ml-auto text-balsa-xs text-balsa-muted-foreground">{data.length}</span>
      </div>
      {isLoading && <LoadingState />}
      {error && (
        <div className="flex items-center justify-between rounded-balsa-control bg-balsa-destructive/10 p-3 text-sm text-balsa-destructive">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {t("loadFailed")}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}
      {!isLoading && !error && data.length === 0 && (
        <div className="rounded-balsa-surface border border-dashed border-balsa-border py-10 text-center">
          <p className="text-sm text-balsa-muted-foreground">{t("empty")}</p>
          <Button
            asChild
            variant="text"
            color="primary"
            size="sm"
            className="mt-2"
          >
            <Link href="/projects">
            {t("emptyAction")}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Button>
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
