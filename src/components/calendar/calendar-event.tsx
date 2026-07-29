"use client";

import { Calendar as CalendarIcon } from "lucide-react";

interface CalendarEventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string | null;
  task?: { id: string; title: string } | null;
}

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
}: {
  event: CalendarEventData;
  onClick?: () => void;
}) {
  const borderColor = event.color
    ? AREA_COLORS[event.color] || event.color
    : "#3b82f6";
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 bg-white border-l-[3px] rounded px-3 py-2 cursor-pointer hover:shadow-sm transition-shadow"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-mono text-text-secondary">
          {startTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          {" — "}
          {endTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-[13px] font-medium text-text-primary truncate">
          {event.title}
        </div>
      </div>
      {event.task && (
        <CalendarIcon size={14} className="text-text-secondary shrink-0 mt-0.5" />
      )}
    </div>
  );
}
