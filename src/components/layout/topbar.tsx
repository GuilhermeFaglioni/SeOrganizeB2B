"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Menu, Plus } from "lucide-react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { PushNotificationToggle } from "@/components/notifications/push-notification-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

interface TopbarProps {
  title?: string;
  onNewClick?: () => void;
  actionLabel?: string;
  onMenuClick?: () => void;
}

export function Topbar({
  title = "Dashboard",
  onNewClick,
  actionLabel = "Novo",
  onMenuClick,
}: TopbarProps) {
  const t = useTranslations("layout.topbar");

  return (
    <header
      data-testid="topbar"
      className="h-14 shrink-0 border-b border-border bg-page-alt/95 px-3 backdrop-blur sm:px-5"
    >
      <div className="flex h-full min-w-0 items-center gap-2">
        {onMenuClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="shrink-0 bg-sidebar text-white hover:bg-sidebar-hover hover:text-white sm:hidden"
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            SeOrganize+
          </p>
          <h1 className="truncate text-heading-1 text-text-primary">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <PushNotificationToggle />
          <NotificationCenter />
          {onNewClick && (
            <Button
              size="sm"
              onClick={onNewClick}
              className="shrink-0"
              aria-label={actionLabel}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{actionLabel}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
