"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useAreas } from "@/hooks/use-areas";
import { AreaFilter } from "@/components/areas/area-filter";
import { ProjectSelector } from "@/components/projects/project-selector";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard, testId: "nav-board" },
  { href: "/calendar", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
  { href: "/documents", label: "Documents", icon: FileText, testId: "nav-documents" },
  { href: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: areas } = useAreas();
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const handleToggleArea = (areaId: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaId)
        ? prev.filter((id) => id !== areaId)
        : [...prev, areaId]
    );
  };

  return (
    <aside
      data-testid="sidebar"
      className="w-[240px] h-screen bg-sidebar flex flex-col shrink-0"
    >
      <div
        data-testid="sidebar-logo"
        className="h-14 flex items-center gap-3 px-4 border-b border-sidebar-divider"
      >
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <span className="text-sidebar-text text-sm font-semibold">
          {APP_NAME}
        </span>
      </div>

      <ProjectSelector />

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-active text-sidebar-text"
                  : "text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {areas && areas.length > 0 && (
        <AreaFilter
          areas={areas}
          selected={selectedAreas}
          onToggle={handleToggleArea}
        />
      )}
    </aside>
  );
}
