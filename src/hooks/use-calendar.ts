import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export function useCalendarAuth() {
  return useQuery<{ connected: boolean; email: string | null }>({
    queryKey: ["calendar-auth"],
    queryFn: () => fetchJson("/api/calendar/auth"),
  });
}

interface CalendarEventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string | null;
  task?: { id: string; title: string } | null;
}

export function useCalendarEvents(timeMin: string, timeMax: string) {
  return useQuery<CalendarEventData[]>({
    queryKey: ["calendar-events", timeMin, timeMax],
    queryFn: () =>
      fetchJson<CalendarEventData[]>(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`),
    enabled: !!timeMin && !!timeMax,
  });
}

export function useScheduleEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      taskId?: string;
      color?: string;
    }) =>
      fetchJson("/api/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/calendar/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
