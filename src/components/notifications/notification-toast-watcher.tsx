"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { toastInfo } from "@/lib/toast";

export function NotificationToastWatcher() {
  const { data } = useNotifications();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!data?.items) return;

    if (isInitialLoad.current) {
      for (const item of data.items) {
        seenIdsRef.current.add(item.id);
      }
      isInitialLoad.current = false;
      return;
    }

    const newUnread: Array<{ id: string; summary: string; actorName: string }> =
      [];

    for (const item of data.items) {
      if (!item.readAt && !seenIdsRef.current.has(item.id)) {
        newUnread.push({
          id: item.id,
          summary: item.activity.summary,
          actorName: item.activity.actor?.name || "Sistema",
        });
        seenIdsRef.current.add(item.id);
      }
    }

    if (newUnread.length === 1) {
      toastInfo(newUnread[0].summary, newUnread[0].actorName);
    } else if (newUnread.length > 1) {
      toastInfo(`${newUnread.length} novas notificações`);
    }
  }, [data]);

  return null;
}
