"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [connectDisclosureOpen, setConnectDisclosureOpen] = useState(false);

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

  async function authorizeGoogleCalendar() {
    setConnectDisclosureOpen(false);
    try {
      const { url } = await fetchJson<{ url: string }>(API, {
        method: "POST",
      });
      window.location.href = url;
    } catch {
      toastError(
        t("toastCalendarConnectFailed"),
        t("toastConnectFailedHint"),
      );
    }
  }

  function openConnectDisclosure() {
    setConnectDisclosureOpen(true);
  }

  function confirmDisconnect() {
    disconnectCalendar.mutate(undefined, {
      onSuccess: ({ revocationFailed }) => {
        setDisconnectOpen(false);
        if (revocationFailed) {
          toastError(t("toastDisconnectRevocationFailed"));
        } else {
          toastSuccess(t("toastGoogleDisconnected"));
        }
      },
      onError: () => {
        toastError(t("toastDisconnectFailed"));
      },
    });
  }

  return (
    <div
      data-testid="calendar-page"
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 xl:flex-row"
    >
      <section className="balsa-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-balsa-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-balsa-2xs uppercase tracking-balsa-label text-balsa-muted-foreground">{t("eyebrow")}</p>
            <h2 className="font-balsa-title text-balsa-3xl text-balsa-foreground">
              {t("title")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && auth?.connected && (
              <>
                <span className="hidden max-w-[220px] truncate text-balsa-xs text-balsa-muted-foreground sm:inline">
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
                onClick={openConnectDisclosure}
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
          <div className="mb-4 rounded-balsa-surface border border-balsa-destructive/20 bg-balsa-destructive/10 px-4 py-3 text-sm text-balsa-destructive">
            <p className="font-semibold">{t("reconnectRequired")}</p>
            <p className="mt-1 text-xs">{t("reconnectRequiredHint")}</p>
          </div>
        )}
        {!isLoading && !auth?.connected && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-balsa-surface border border-balsa-primary/20 bg-balsa-primary/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-balsa-primary">
                {t("localCalendarActive")}
              </p>
              <p className="text-balsa-xs text-balsa-primary">
                {t("localCalendarHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={openConnectDisclosure}
              className="inline-flex items-center gap-1 text-balsa-xs font-semibold text-balsa-primary"
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
                ? openConnectDisclosure
                : undefined
            }
          />
        </div>
      </section>
      <aside className="balsa-surface min-h-0 w-full shrink-0 overflow-y-auto rounded-balsa-panel p-4 xl:w-[330px]">
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
      <Dialog open={connectDisclosureOpen} onOpenChange={setConnectDisclosureOpen}>
        <DialogContent data-testid="calendar-connect-disclosure">
          <DialogHeader>
            <DialogTitle>{t("connectDisclosureTitle")}</DialogTitle>
            <DialogDescription>{t("connectDisclosureDescription")}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-balsa-muted-foreground">
            <li>{t("connectDisclosureData")}</li>
            <li>{t("connectDisclosurePurpose")}</li>
            <li>{t("connectDisclosureScope")}</li>
          </ul>
          <p className="text-sm text-balsa-muted-foreground">
            <Link href="/privacy" className="text-balsa-primary hover:underline">
              {t("connectDisclosurePrivacy")}
            </Link>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDisclosureOpen(false)}>
              {t("connectDisclosureCancel")}
            </Button>
            <Button onClick={authorizeGoogleCalendar}>
              {t("connectDisclosureContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
