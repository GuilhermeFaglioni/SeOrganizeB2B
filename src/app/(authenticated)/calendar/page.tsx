"use client";

import { useState } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import { UpcomingTasksPanel } from "@/components/calendar/upcoming-tasks-panel";
import { ScheduleEventModal } from "@/components/calendar/schedule-event-modal";
import { useCalendarAuth } from "@/hooks/use-calendar";
import { useProjects } from "@/hooks/use-projects";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";

const API = "/api/calendar/auth";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export default function CalendarPage() {
  const { data: auth, isLoading } = useCalendarAuth();
  const { data: projects } = useProjects();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  const upcomingTasks = (projects || [])
    .flatMap((p: { id: string; name: string; _count?: { tasks: number } }) =>
      p._count ? [{ id: p.id, title: p.name, priority: "medium", dueDate: null }] : []
    );

  return (
    <div data-testid="calendar-page" className="flex h-full">
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {!auth?.connected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-body-secondary text-text-secondary">Connect your Google Calendar to get started</p>
            <Button
              data-testid="connect-google-calendar"
              onClick={async () => {
                const { url } = await fetchJson<{ url: string }>(API, { method: "POST" });
                window.location.href = url;
              }}
            >
              Connect Google Calendar
            </Button>
          </div>
        ) : (
          <CalendarView />
        )}
      </div>
      <div className="w-[300px] border-l border-border p-4 overflow-y-auto shrink-0">
        <UpcomingTasksPanel tasks={upcomingTasks} />
      </div>
      <ScheduleEventModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </div>
  );
}
