"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { NotificationItem } from "@/lib/activity/types";

interface NotificationData {
  items: NotificationItem[];
  unreadCount: number;
}

async function request(url: string, init?: RequestInit, fallbackMessage?: string) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error?.message || fallbackMessage || "Request failed");
  return body.data;
}

export function useNotifications() {
  const t = useTranslations("hooks.notifications");
  return useQuery<NotificationData>({
    queryKey: ["notifications"],
    queryFn: () => request("/api/notifications", undefined, t("requestFailed")),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const t = useTranslations("hooks.notifications");
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/notifications/${id}`, { method: "PATCH" }, t("requestFailed")),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationData>([
        "notifications",
      ]);
      queryClient.setQueryData<NotificationData>(
        ["notifications"],
        (current) => {
          if (!current) return current;
          const wasUnread = current.items.some(
            (item) => item.id === id && !item.readAt
          );
          return {
            items: current.items.map((item) =>
              item.id === id
                ? { ...item, readAt: item.readAt || new Date().toISOString() }
                : item
            ),
            unreadCount: Math.max(
              0,
              current.unreadCount - (wasUnread ? 1 : 0)
            ),
          };
        }
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const t = useTranslations("hooks.notifications");
  return useMutation({
    mutationFn: () =>
      request("/api/notifications", { method: "PATCH" }, t("requestFailed")),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationData>([
        "notifications",
      ]);
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationData>(
        ["notifications"],
        (current) =>
          current
            ? {
                items: current.items.map((item) => ({
                  ...item,
                  readAt: item.readAt || readAt,
                })),
                unreadCount: 0,
              }
            : current
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
