"use client";

import { useMutation } from "@tanstack/react-query";

export interface CalendarConflict {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  source: "google" | "local";
}

export function useCalendarConflicts() {
  return useMutation<
    {
      conflicts: CalendarConflict[];
      googleStatus: "connected" | "not_connected" | "unavailable";
    },
    Error,
    { startTime: string; endTime: string }
  >({
    mutationFn: async (range) => {
      const response = await fetch("/api/calendar/conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(range),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || "Conflict check failed");
      }
      return body.data;
    },
  });
}
