"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { UpcomingTasksPanel } from "@/components/calendar/upcoming-tasks-panel";
import {
  useCalendarAuth,
  useDisconnectCalendar,
  useUpcomingTasks,
} from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { ExternalLink, Link2, Unlink } from "lucide-react";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { toastError, toastSuccess } from "@/lib/toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const API = "/api/calendar/auth";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function CalendarPage() {
  const t = useTranslations("calendar.page");
  const { data: auth, isLoading } = useCalendarAuth();
  const disconnectCalendar = useDisconnectCalendar();
  const {
    data: upcomingTasks = [],
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useUpcomingTasks();
  const { openScheduleEvent } = useScheduleEventDialog();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    const authResult = searchParams.get("calendarAuth");
    if (authResult === "connected") {
      toastSuccess(t("toastGoogleConnected"));
      router.replace("/calendar");
    } else if (authResult === "failed" || searchParams.get("error")) {
      toastError(
        t("toastConnectFailed"),
        t("toastConnectFailedHint"),
      );
      router.replace("/calendar");
    }
  }, [router, searchParams, t]);

  async function connectGoogleCalendar() {
    try {
      const { url } = await fetchJson<{ url: string }>(API, {
        method: "POST",
      });
      window.location.href = url;
    } catch (error) {
      toastError(
        t("toastCalendarConnectFailed"),
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  function confirmDisconnect() {
    disconnectCalendar.mutate(undefined, {
      onSuccess: () => {
        setDisconnectOpen(false);
        toastSuccess(t("toastGoogleDisconnected"));
      },
      onError: (error) => {
        toastError(
          t("toastDisconnectFailed"),
          error instanceof Error ? error.message : undefined,
        );
      },
    });
  }

  return (
    <div
      data-testid="calendar-page"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 xl:flex-row"
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-page-alt p-4 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label uppercase text-text-muted">{t("eyebrow")}</p>
            <h2 className="text-display text-text-primary">
              {t("title")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && auth?.connected && (
              <>
                <span className="hidden max-w-[220px] truncate text-xs text-text-secondary sm:inline">
                  {auth.email ?? t("connectedAccountUnknown")}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setDisconnectOpen(true)}
                  disabled={disconnectCalendar.isPending}
                >
                  <Unlink className="h-4 w-4" />
                  {t("disconnectGoogle")}
                </Button>
              </>
            )}
            {!isLoading && !auth?.connected && (
              <Button
                data-testid="connect-google-calendar"
                variant="outline"
                onClick={connectGoogleCalendar}
              >
                <Link2 className="h-4 w-4" />
                {auth?.status === "reconnect_required"
                  ? t("reconnectGoogle")
                  : t("connectGoogle")}
              </Button>
            )}
          </div>
        </div>
        {!isLoading && auth?.status === "reconnect_required" && (
          <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            <p className="font-semibold">{t("reconnectRequired")}</p>
            <p className="mt-1 text-xs">{t("reconnectRequiredHint")}</p>
          </div>
        )}
        {!isLoading && !auth?.connected && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-brand-900">
                {t("localCalendarActive")}
              </p>
              <p className="text-xs text-brand-700">
                {t("localCalendarHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={connectGoogleCalendar}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
            >
              {t("connectNow")}
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
              auth?.connected || auth?.status === "reconnect_required"
                ? connectGoogleCalendar
                : undefined
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
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title={t("disconnectTitle")}
        description={t("disconnectDescription")}
        confirmLabel={t("disconnectConfirm")}
        cancelLabel={t("disconnectCancel")}
        variant="destructive"
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}
