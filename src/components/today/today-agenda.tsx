"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { LoadingState } from "@/components/shared/loading-state";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function TodayAgenda() {
  const range = todayRange();
  const { data = [], isLoading, error, refetch } = useCalendarEvents(
    range.start,
    range.end
  );
  return (
    <section className="rounded-2xl border border-border bg-page-alt p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-accent" />
        <h3 className="text-heading-1 text-text-primary">Agenda</h3>
      </div>
      {isLoading && <LoadingState />}
      {error && (
        <button
          className="text-sm text-danger underline"
          onClick={() => refetch()}
        >
          Falha ao carregar agenda. Tentar novamente.
        </button>
      )}
      {!isLoading && !error && data.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-secondary">
          Agenda livre hoje.
        </p>
      )}
      <div className="space-y-2">
        {data.map((event) => (
          <div
            key={event.id}
            className="flex gap-3 rounded-xl border border-border bg-page-alt p-3"
          >
            <Clock3 className="mt-0.5 h-4 w-4 text-accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {event.title}
              </p>
              <p className="text-xs text-text-secondary">
                {event.allDay
                  ? "Dia inteiro"
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
