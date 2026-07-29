"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TopbarProps {
  title?: string;
}

export function Topbar({ title = "Dashboard" }: TopbarProps) {
  return (
    <header
      data-testid="topbar"
      className="h-14 bg-white border-b border-border flex items-center justify-between px-5 shrink-0"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-heading-1 text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm">
          <Plus className="w-4 h-4" aria-hidden="true" />
          New
        </Button>
      </div>
    </header>
  );
}
