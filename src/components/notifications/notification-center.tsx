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

export function NotificationCenter() {
  const router = useRouter();
  const t = useTranslations("notifications.center");
  const { data, isLoading } = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.items ?? [];

  async function openNotification(id: string, entityType: string) {
    await markOne.mutateAsync(id);
    router.push(
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
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-page"
          aria-label={t("unreadAria", { count: data?.unreadCount ?? 0 })}
        >
          <Bell className="h-4 w-4" />
          {!!data?.unreadCount && (
            <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">
              {Math.min(data.unreadCount, 99)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-24px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">{t("title")}</p>
          <button
            onClick={() => markAll.mutate()}
            disabled={!data?.unreadCount}
            className="flex items-center gap-1 text-xs font-medium text-accent disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" /> {t("markAll")}
          </button>
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
              className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-page ${
                item.readAt ? "bg-page-alt" : "bg-brand-50/60"
              }`}
            >
              <p className="text-sm text-text-primary">
                {item.activity.summary}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
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
