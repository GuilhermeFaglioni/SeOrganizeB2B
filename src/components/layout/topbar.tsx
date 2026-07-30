"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { NotificationCenter } from "@/components/notifications/notification-center";

interface TopbarProps {
  title?: string;
  onNewClick?: () => void;
  actionLabel?: string;
}

export function Topbar({
  title = "Dashboard",
  onNewClick,
  actionLabel = "Novo",
}: TopbarProps) {
  return (
    <header
      data-testid="topbar"
      className="h-14 shrink-0 border-b border-border bg-white/95 px-5 backdrop-blur"
    >
      <div className="flex h-full items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            SeOrganize+
          </p>
          <h1 className="text-heading-1 text-text-primary">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <NotificationCenter />
        {onNewClick && (
          <Button size="sm" onClick={onNewClick}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            {actionLabel}
          </Button>
        )}
        </div>
      </div>
    </header>
  );
}
