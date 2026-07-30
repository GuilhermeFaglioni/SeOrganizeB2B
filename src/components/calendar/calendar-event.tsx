"use client";

import { Calendar as CalendarIcon } from "lucide-react";

import type { CalendarEventData } from "@/lib/calendar/types";
import { motion, useReducedMotion } from "motion/react";

const AREA_COLORS: Record<string, string> = {
  "1": "#3b82f6",
  "2": "#10b981",
  "3": "#f97316",
  "4": "#ec4899",
  "5": "#8b5cf6",
  "6": "#06b6d4",
  "7": "#ef4444",
  "8": "#84cc16",
  "9": "#f59e0b",
  "10": "#6366f1",
  "11": "#14b8a6",
};

export function CalendarEvent({
  event,
  onClick,
  timeText,
  compact = false,
}: {
  event: CalendarEventData | null | undefined;
  onClick?: () => void;
  timeText?: string;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  if (!event) return null;
  const borderColor = event.color
    ? AREA_COLORS[event.color] || event.color
    : "#3b82f6";
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <motion.div
      onClick={onClick}
      aria-label={`${event.title}, ${
        event.allDay ? "dia inteiro" : timeText || "horário definido"
      }, ${event.attendees.length} participantes`}
      initial={reduceMotion ? false : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
      className={
        compact
          ? "flex h-full min-w-0 items-start gap-1 overflow-hidden rounded px-1.5 py-0.5"
          : "flex cursor-pointer items-start gap-3 rounded border-l-[3px] bg-white px-3 py-2 transition-shadow hover:shadow-sm"
      }
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex-1 min-w-0">
        {!event.allDay && (
          <div className="truncate font-mono text-[10px] text-text-secondary">
            {timeText ||
              `${startTime.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })} — ${endTime.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </div>
        )}
        <div className="truncate text-[12px] font-semibold text-text-primary">
          {event.title}
        </div>
      </div>
      {event.task && (
        <CalendarIcon size={14} className="text-text-secondary shrink-0 mt-0.5" />
      )}
    </motion.div>
  );
}
