"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { useTranslations } from "next-intl";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useIsMobile, useIsTablet } from "@/hooks/use-media-query";
import { CalendarEvent } from "./calendar-event";
import { toastError } from "@/lib/toast";
import { useCan } from "@/hooks/use-permissions";
import { EventDetailModal } from "./event-detail-modal";
import type { CalendarEventData } from "@/lib/calendar/types";

const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986CB",
  "2": "#33B679",
  "3": "#8E24AA",
  "4": "#E67C73",
  "5": "#F6BF26",
  "6": "#F4511E",
  "7": "#039BE5",
  "8": "#616161",
  "9": "#3F51B5",
  "10": "#0B8043",
  "11": "#D50000",
};

function initialRange() {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function CalendarView({
  onEventClick,
  onCreateEvent,
  onSyncError,
}: {
  onEventClick?: (id: string) => void;
  onCreateEvent?: (date: string, allDay: boolean) => void;
  onSyncError?: () => void;
}) {
  const t = useTranslations("calendar.view");
  const { can } = useCan();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const calendarRef = useRef<FullCalendar>(null);
  const [range, setRange] = useState(initialRange);
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventData | null>(null);
  const {
    data: events = [],
    isLoading,
    error,
    refetch,
  } = useCalendarEvents(
    range.timeMin,
    range.timeMax,
  );
  const calendarEvents = useMemo(
    () =>
      events.filter(Boolean).map((event) => {
        const eventColor = event.color
          ? GOOGLE_EVENT_COLORS[event.color] || event.color
          : "#2F6FED";
        return {
        id: event.id,
        title: event.title,
        start: event.startTime,
        end: event.endTime,
        allDay: event.allDay,
        backgroundColor: `${eventColor}22`,
        borderColor: eventColor,
        textColor: "#0f172a",
        extendedProps: { eventData: event },
        };
      }),
    [events],
  );

  function handleDatesSet(info: DatesSetArg) {
    setRange({
      timeMin: info.start.toISOString(),
      timeMax: info.end.toISOString(),
    });
  }

  function handleEventClick(info: EventClickArg) {
    setSelectedEvent(
      info.event.extendedProps.eventData as CalendarEventData
    );
    onEventClick?.(info.event.id);
  }

  useEffect(() => {
    if (error) {
      console.error("Calendar query failed:", error);
      toastError(
        t("syncToastFailed"),
        t("syncFailed"),
      );
    }
  }, [error, t]);

  useEffect(() => {
    if (isMobile || isTablet) {
      calendarRef.current?.getApi().changeView("timeGridDay");
    }
  }, [isMobile, isTablet]);

  return (
    <div
      data-testid="calendar-view"
      className="executive-calendar relative h-full min-h-0"
    >
      {isLoading && (
        <div className="pointer-events-none absolute right-4 top-3 z-10 rounded-full border border-border bg-page-alt/90 px-3 py-1 text-xs text-text-secondary shadow-card">
          {t("syncing")}
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger shadow-card">
          <span>
            {t("syncFailed")}
          </span>
          <button
            type="button"
            onClick={() => {
              if (onSyncError) onSyncError();
              else refetch();
            }}
            className="font-semibold underline underline-offset-2"
          >
            {onSyncError ? t("reconnectGoogle") : t("retry")}
          </button>
        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: isMobile
            ? "timeGridDay,dayGridMonth"
            : "timeGridWeek,timeGridDay,dayGridMonth",
        }}
        buttonText={{
          today: t("fcToday"),
          month: t("fcMonth"),
          week: t("fcWeek"),
          day: t("fcDay"),
        }}
        allDayText={t("fcAllDay")}
        firstDay={1}
        nowIndicator
        selectable
        selectMirror
        dayMaxEvents
        height="100%"
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:30:00"
        events={calendarEvents}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        dateClick={(info) => can("calendar.create") && onCreateEvent?.(info.dateStr, info.allDay)}
        select={(info) => can("calendar.create") && onCreateEvent?.(info.startStr, info.allDay)}
        eventContent={(info) => (
          <CalendarEvent
            event={info.event.extendedProps.eventData}
            timeText={info.timeText}
            compact
          />
        )}
      />
      <EventDetailModal
        event={selectedEvent}
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
      />
    </div>
  );
}
