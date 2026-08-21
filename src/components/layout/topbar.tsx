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
      className="h-14 shrink-0 border-b border-balsa-border bg-balsa-surface/80 px-3 backdrop-balsa sm:px-5"
    >
      <div className="flex h-full min-w-0 items-center gap-2">
        {onMenuClick && (
          <Button
            type="button"
            variant="solid"
            color="neutral"
            size="icon"
            onClick={onMenuClick}
            className="shrink-0 bg-balsa-inverse text-balsa-inverse-foreground hover:bg-balsa-inverse/90 sm:hidden"
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-balsa-2xs font-semibold uppercase tracking-balsa-label text-balsa-muted-foreground">
            SeOrganize+
          </p>
          <h1 className="truncate font-balsa-title text-lg font-semibold tracking-tight text-balsa-foreground">{title}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <PushNotificationToggle />
          <NotificationCenter />
          {onNewClick && (
            <Button
              size="sm"
              prefixIcon={Plus}
              onClick={onNewClick}
              className="shrink-0"
              aria-label={actionLabel}
            >
              <span className="hidden sm:inline">{actionLabel}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
