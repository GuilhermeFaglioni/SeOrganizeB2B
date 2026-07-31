"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { UpcomingTasksPanel } from "@/components/calendar/upcoming-tasks-panel";
import { useCalendarAuth, useUpcomingTasks } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link2 } from "lucide-react";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { toastError, toastSuccess } from "@/lib/toast";

const API = "/api/calendar/auth";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function CalendarPage() {
  const { data: auth, isLoading } = useCalendarAuth();
  const {
    data: upcomingTasks = [],
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useUpcomingTasks();
  const { openScheduleEvent } = useScheduleEventDialog();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const authResult = searchParams.get("calendarAuth");
    if (authResult === "connected") {
      toastSuccess("Google Calendar conectado");
      router.replace("/calendar");
    } else if (authResult === "failed" || searchParams.get("error")) {
      toastError(
        "Falha ao conectar Google Calendar",
        "Tente autorizar novamente.",
      );
      router.replace("/calendar");
    }
  }, [router, searchParams]);

  async function connectGoogleCalendar() {
    try {
      const { url } = await fetchJson<{ url: string }>(API, {
        method: "POST",
      });
      window.location.href = url;
    } catch (error) {
      toastError(
        "Falha ao conectar calendário",
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  return (
    <div
      data-testid="calendar-page"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 xl:flex-row"
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-page-alt p-4 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label uppercase text-text-muted">Agenda</p>
            <h2 className="text-display text-text-primary">
              Calendário executivo
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && !auth?.connected && (
              <Button
                data-testid="connect-google-calendar"
                variant="outline"
                onClick={connectGoogleCalendar}
              >
                <Link2 className="h-4 w-4" />
                Conectar Google
              </Button>
            )}
          </div>
        </div>
        {!isLoading && !auth?.connected && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-brand-900">
                Calendário local ativo
              </p>
              <p className="text-xs text-brand-700">
                Conecte Google Calendar para sincronizar eventos e enviar
                convites.
              </p>
            </div>
            <button
              type="button"
              onClick={connectGoogleCalendar}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
            >
              Conectar agora
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <CalendarView
            onCreateEvent={(date, allDay) =>
              openScheduleEvent({ startDate: date, allDay })
            }
            onSyncError={
              auth?.connected ? connectGoogleCalendar : undefined
            }
          />
        </div>
      </section>
      <aside className="min-h-0 w-full shrink-0 overflow-y-auto rounded-2xl border border-border bg-page-alt p-4 xl:w-[330px]">
        <UpcomingTasksPanel
          tasks={upcomingTasks}
          isLoading={tasksLoading}
          error={tasksError}
          onRetry={() => refetchTasks()}
        />
      </aside>
    </div>
  );
}
