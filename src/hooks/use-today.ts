"use client";

import { useQuery } from "@tanstack/react-query";
import type { BoardTask } from "@/hooks/use-kanban";

export interface TodayTask extends BoardTask {
  project: { id: string; name: string };
}

export function useTodayTasks() {
  return useQuery<TodayTask[]>({
    queryKey: ["today-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/today/tasks");
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || "Failed to load today tasks");
      }
      return body.data;
    },
  });
}
