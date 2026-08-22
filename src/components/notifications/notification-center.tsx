"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pushWithAIStudioGuard } from "@/lib/ai/studio-router-guard";

export function NotificationCenter() {
  const router = useRouter();
  const t = useTranslations("notifications.center");
  const { data, isLoading } = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.items ?? [];

  async function openNotification(id: string, entityType: string) {
    await markOne.mutateAsync(id);
    pushWithAIStudioGuard(router,
      entityType === "document"
        ? "/documents"
        : entityType === "calendar_event"
          ? "/calendar"
          : "/board"
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="text"
          color="neutral"
          size="icon"
          className="relative text-balsa-muted-foreground hover:bg-balsa-muted hover:text-balsa-foreground"
          aria-label={t("unreadAria", { count: data?.unreadCount ?? 0 })}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {!!data?.unreadCount && (
            <Badge
              variant="solid"
              color="destructive"
              size="sm"
              className="absolute right-0.5 top-0.5 min-w-4 px-1 py-0 text-[10px] leading-4"
            >
              {Math.min(data.unreadCount, 99)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-24px)] p-0">
        <div className="flex items-center justify-between border-b border-balsa-border px-4 py-3">
          <p className="font-balsa-title text-sm font-semibold text-balsa-foreground">{t("title")}</p>
          <Button
            type="button"
            variant="text"
            color="primary"
            size="sm"
            prefixIcon={CheckCheck}
            onClick={() => markAll.mutate()}
            disabled={!data?.unreadCount}
            className="min-h-8 px-0 text-xs font-medium disabled:opacity-40"
          >
            {t("markAll")}
          </Button>
        </div>
        <div className="max-h-[440px] overflow-y-auto" aria-live="polite">
          {isLoading && (
            <p className="p-6 text-center text-sm text-text-secondary">
              {t("loading")}
            </p>
          )}
          {!isLoading && !items.length && (
            <p className="p-8 text-center text-sm text-text-secondary">
              {t("empty")}
            </p>
          )}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                openNotification(item.id, item.activity.entityType)
              }
               data-balsa="link"
               className={`block w-full border-b border-balsa-border px-4 py-3 text-left transition-colors hover:bg-balsa-muted ${
                 item.readAt ? "bg-balsa-surface" : "bg-balsa-primary/10"
               }`}
             >
               <p className="text-sm text-balsa-foreground">
                 {item.activity.summary}
               </p>
               <p className="mt-1 text-xs text-balsa-muted-foreground">
                {item.activity.actor?.name || t("system")} ·{" "}
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
