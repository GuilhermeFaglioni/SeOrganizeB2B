import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CalendarEventData } from "@/lib/calendar/types";

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

export function useCalendarEvents(timeMin: string, timeMax: string) {
  return useQuery<
    {
      events: CalendarEventData[];
      connection: { connected: boolean; email: string | null };
    },
    Error,
    CalendarEventData[]
  >({
    queryKey: ["calendar-events", timeMin, timeMax],
    queryFn: () =>
      fetchJson<{
        events: CalendarEventData[];
        connection: { connected: boolean; email: string | null };
      }>(`/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`),
    enabled: !!timeMin && !!timeMax,
    select: (payload) => payload.events,
  });
}

export function useScheduleEvent() {
  const queryClient = useQueryClient();

  return useMutation<CalendarEventData, Error, {
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      allDay?: boolean;
      timeZone?: string;
      taskId?: string;
      areaId?: string;
      color?: string;
      profileIds?: string[];
      attendeeEmails?: string[];
    }>({
    mutationFn: (data) =>
      fetchJson("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export interface UpcomingTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string };
  area: { id: string; name: string; color: string } | null;
  assignees: Array<{
    profileId: string;
    profile: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
}

export function useUpcomingTasks() {
  return useQuery<UpcomingTask[]>({
    queryKey: ["tasks", "upcoming"],
    queryFn: () => fetchJson<UpcomingTask[]>("/api/tasks/upcoming"),
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

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation<
    CalendarEventData,
    Error,
    { id: string; taskId: string | null; areaId: string | null }
  >({
    mutationFn: ({ id, ...data }) =>
      fetchJson(`/api/calendar/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
