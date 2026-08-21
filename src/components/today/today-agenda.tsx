"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function TodayAgenda() {
  const t = useTranslations("today.agenda");
  const range = todayRange();
  const { data = [], isLoading, error, refetch } = useCalendarEvents(
    range.start,
    range.end
  );
  return (
    <section className="balsa-surface rounded-balsa-panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-balsa-primary" />
        <h3 className="font-balsa-title text-lg font-semibold text-balsa-foreground">{t("heading")}</h3>
      </div>
      {isLoading && <LoadingState />}
      {error && (
        <Button
          type="button"
          variant="text"
          color="destructive"
          size="sm"
          className="px-0 text-sm underline"
          onClick={() => refetch()}
        >
          {t("loadFailed")}
        </Button>
      )}
      {!isLoading && !error && data.length === 0 && (
        <p className="rounded-balsa-surface border border-dashed border-balsa-border py-10 text-center text-sm text-balsa-muted-foreground">
          {t("empty")}
        </p>
      )}
      <div className="space-y-2">
        {data.map((event) => (
          <div
            key={event.id}
            className="flex gap-3 rounded-balsa-surface border border-balsa-border bg-balsa-surface/70 p-3"
          >
            <Clock3 className="mt-0.5 h-4 w-4 text-balsa-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-balsa-foreground">
                {event.title}
              </p>
              <p className="text-balsa-xs text-balsa-muted-foreground">
                {event.allDay
                  ? t("allDay")
                  : new Date(event.startTime).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
