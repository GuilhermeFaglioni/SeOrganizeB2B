"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ActivityItem } from "@/lib/activity/types";

export function useActivity(taskId?: string, limit = 20) {
  const t = useTranslations("hooks.activity");
  return useQuery<ActivityItem[]>({
    queryKey: ["activity", taskId ?? "mine", limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (taskId) params.set("taskId", taskId);
      const response = await fetch(`/api/activity?${params}`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || t("loadFailed"));
      }
      return body.data;
    },
    refetchInterval: taskId ? false : 30_000,
  });
}
