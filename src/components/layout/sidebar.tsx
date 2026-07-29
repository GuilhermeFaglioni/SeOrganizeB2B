"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useAreas } from "@/hooks/use-areas";
import { AreaFilter } from "@/components/areas/area-filter";
import { ProjectSelector } from "@/components/projects/project-selector";
import { useIsTablet, useIsMobile } from "@/hooks/use-media-query";

const navItems = [
  { href: "/board", label: "Board", icon: LayoutDashboard, testId: "nav-board" },
  { href: "/calendar", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
  { href: "/documents", label: "Documents", icon: FileText, testId: "nav-documents" },
  { href: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: areas } = useAreas();
  const isTablet = useIsTablet();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedAreas = searchParams.get("areas")?.split(",").filter(Boolean) || [];

  const handleToggleArea = (areaId: string) => {
    const next = selectedAreas.includes(areaId)
      ? selectedAreas.filter((id) => id !== areaId)
      : [...selectedAreas, areaId];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) {
      params.set("areas", next.join(","));
    } else {
      params.delete("areas");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 bg-sidebar rounded-lg text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
            <aside
              data-testid="sidebar"
              className="fixed top-0 left-0 w-[240px] h-screen bg-sidebar flex flex-col shrink-0 z-50"
            >
              <div data-testid="sidebar-logo" className="h-14 flex items-center justify-between px-4 border-b border-sidebar-divider">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <span className="text-white text-sm font-bold">S</span>
                  </div>
                  <span className="text-sidebar-text text-sm font-semibold">{APP_NAME}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close menu">
                  <X size={20} />
                </button>
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
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                        isActive ? "bg-sidebar-active text-sidebar-text" : "text-sidebar-text-muted hover:bg-sidebar-hover"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              {areas && areas.length > 0 && <AreaFilter areas={areas} selected={selectedAreas} onToggle={handleToggleArea} />}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        "h-screen bg-sidebar flex flex-col shrink-0 transition-all duration-200",
        isTablet ? "w-16" : "w-[240px]"
      )}
    >
      <div data-testid="sidebar-logo" className={cn("h-14 flex items-center border-b border-sidebar-divider", isTablet ? "justify-center px-2" : "gap-3 px-4")}>
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        {!isTablet && (
          <span className="text-sidebar-text text-sm font-semibold">{APP_NAME}</span>
        )}
      </div>

      {!isTablet && <ProjectSelector />}

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              title={isTablet ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                isTablet ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive ? "bg-sidebar-active text-sidebar-text" : "text-sidebar-text-muted hover:bg-sidebar-hover"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {!isTablet && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!isTablet && areas && areas.length > 0 && (
        <AreaFilter areas={areas} selected={selectedAreas} onToggle={handleToggleArea} />
      )}
    </aside>
  );
}
