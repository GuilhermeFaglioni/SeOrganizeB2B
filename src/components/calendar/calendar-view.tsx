"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useIsMobile } from "@/hooks/use-media-query";
import { CalendarEvent } from "./calendar-event";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am to 6pm

function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function getEventPosition(event: { startTime: string }, dayStart: Date): { day: number; top: number; height: number } {
  const start = new Date(event.startTime);
  const dayDiff = Math.floor((start.getTime() - dayStart.getTime()) / 86400000);
  const minutesFromMidnight = start.getHours() * 60 + start.getMinutes();
  const top = Math.max(0, (minutesFromMidnight - 480) * 2); // 8am = 0, 2px per minute
  return { day: dayDiff, top, height: 60 };
}

export function CalendarView({ onEventClick }: { onEventClick?: (id: string) => void }) {
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">(isMobile ? "day" : "week");

  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate]);
  const startDate = viewMode === "day" ? currentDate : weekRange.start;
  const endDate = viewMode === "day" ? currentDate : weekRange.end;

  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  const { data: events } = useCalendarEvents(timeMin, timeMax);

  const dayHeaders = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    }
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekRange.start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate, viewMode, weekRange]);

  function navigate(direction: number) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * (viewMode === "day" ? 1 : 7));
    setCurrentDate(newDate);
  }

  function todayClick() {
    setCurrentDate(new Date());
  }

  return (
    <div data-testid="calendar-view" className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-bg-secondary rounded">
            <ChevronLeft size={18} />
          </button>
          <span className="text-heading-1 font-semibold">{formatRange(weekRange.start, weekRange.end)}</span>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-bg-secondary rounded">
            <ChevronRight size={18} />
          </button>
          <button onClick={todayClick} className="ml-2 text-sm px-3 py-1 rounded-md border border-border hover:bg-bg-secondary">
            Today
          </button>
        </div>
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-sm rounded-md ${viewMode === "week" ? "bg-white shadow-sm" : ""}`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={`px-3 py-1 text-sm rounded-md ${viewMode === "day" ? "bg-white shadow-sm" : ""}`}
          >
            Day
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-border min-h-[600px]">
          <div className="bg-bg-secondary" />
          {dayHeaders.map((day, i) => (
            <div key={i} className="bg-bg-secondary text-center py-2 text-caption font-medium text-text-secondary">
              {DAYS[i % 7]} {day.getDate()}
            </div>
          ))}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="bg-white text-right pr-2 text-[11px] text-text-secondary font-mono py-0 relative -top-2.5">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {dayHeaders.map((_, dayIdx) => (
                <div key={dayIdx} className="bg-white border-t border-border min-h-[60px] relative" />
              ))}
            </div>
          ))}

          {events?.map((event) => {
            const pos = getEventPosition(event, startDate);
            if (pos.day < 0 || pos.day >= dayHeaders.length) return null;
            return (
              <div
                key={event.id}
                className="absolute pointer-events-auto cursor-pointer"
                style={{
                  gridColumn: `${pos.day + 2} / span 1`,
                  gridRow: `${Math.floor(pos.top / 60) + 2} / span 1`,
                  top: pos.top % 60,
                  left: 2,
                  right: 2,
                }}
                onClick={() => onEventClick?.(event.id)}
              >
                <CalendarEvent event={event} />
              </div>
            );
          })}
          <div />
        </div>
      </div>
    </div>
  );
}
