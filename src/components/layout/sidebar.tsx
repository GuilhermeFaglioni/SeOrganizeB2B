"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  SunMedium,
  Calendar,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useIsTablet, useIsMobile } from "@/hooks/use-media-query";
import { useAuth } from "@/stores/auth-context";
import { motion } from "motion/react";

const navItems = [
  { href: "/", label: "Hoje", icon: SunMedium, testId: "nav-today" },
  { href: "/board", label: "Board", icon: LayoutDashboard, testId: "nav-board" },
  { href: "/projects", label: "Projetos", icon: FolderKanban, testId: "nav-projects" },
  { href: "/calendar", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
  { href: "/documents", label: "Documents", icon: FileText, testId: "nav-documents" },
  { href: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

function isRouteActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const isTablet = useIsTablet();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, user } = useAuth();

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
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sidebar shadow-sm">
                    <span className="text-sm font-bold">S+</span>
                  </div>
                  <span className="text-sidebar-text text-sm font-semibold">{APP_NAME}</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isRouteActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-testid={item.testId}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "relative isolate flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "text-sidebar-text" : "text-sidebar-text-muted hover:bg-sidebar-hover"
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-route"
                          className="absolute inset-0 -z-10 rounded-md bg-sidebar-active shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 38,
                          }}
                        />
                      )}
                      <Icon className="relative z-10 w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-sidebar-divider p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <UserIcon size={14} className="text-sidebar-text" />
                    </div>
                    <span className="text-sm text-sidebar-text truncate">
                      {user?.user_metadata?.full_name || user?.email || "User"}
                    </span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="text-sidebar-text-muted hover:text-sidebar-text transition-colors p-1"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sidebar shadow-sm">
          <span className="text-sm font-bold">S+</span>
        </div>
        {!isTablet && (
          <span className="text-sidebar-text text-sm font-semibold">{APP_NAME}</span>
        )}
      </div>

      <nav className="overflow-y-auto p-3 pb-1 space-y-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              title={isTablet ? item.label : undefined}
              className={cn(
                "relative isolate flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                isTablet ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive ? "text-sidebar-text" : "text-sidebar-text-muted hover:bg-sidebar-hover"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-route"
                  className="absolute inset-0 -z-10 rounded-md bg-sidebar-active shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 38,
                  }}
                />
              )}
              <Icon className="relative z-10 w-4 h-4 shrink-0" aria-hidden="true" />
              {!isTablet && <span className="relative z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className={cn("border-t border-sidebar-divider p-3", isTablet && "flex justify-center")}>
        {isTablet ? (
          <button
            onClick={() => signOut()}
            className="text-sidebar-text-muted hover:text-sidebar-text transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <UserIcon size={14} className="text-sidebar-text" />
              </div>
              <span className="text-sm text-sidebar-text truncate">
                {user?.user_metadata?.full_name || user?.email || "User"}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-sidebar-text-muted hover:text-sidebar-text transition-colors p-1"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
