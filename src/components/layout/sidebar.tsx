"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderKanban,
  SunMedium,
  Calendar,
  FileText,
  Settings,
  Wallet,
  CreditCard,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useIsTablet, useIsMobile } from "@/hooks/use-media-query";
import { useAuth } from "@/stores/auth-context";
import { useCan, hasFinancialView } from "@/hooks/use-permissions";
import { useAllowedModules } from "@/hooks/use-allowed-modules";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function isRouteActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname();
  const isTablet = useIsTablet();
  const isMobile = useIsMobile();
  const { signOut, user } = useAuth();
  const t = useTranslations("layout.sidebar");
  const { can, data } = useCan();
  const { isModuleAllowed, isAnyFinancialAllowed } = useAllowedModules();
  const userLabel = user?.user_metadata?.full_name || user?.email || t("user");

  const navItems = [
    { href: "/app", label: t("today"), icon: SunMedium, testId: "nav-today", visible: can("tasks.view") && isModuleAllowed("tasks") },
    { href: "/board", label: t("board"), icon: LayoutDashboard, testId: "nav-board", visible: can("tasks.view") && isModuleAllowed("tasks") },
    { href: "/projects", label: t("projects"), icon: FolderKanban, testId: "nav-projects", visible: can("projects.view") && isModuleAllowed("projects") },
    { href: "/calendar", label: t("calendar"), icon: Calendar, testId: "nav-calendar", visible: can("calendar.view") && isModuleAllowed("calendar") },
    { href: "/documents", label: t("documents"), icon: FileText, testId: "nav-documents", visible: can("documents.view") && isModuleAllowed("documents") },
    { href: "/financial", label: t("financial"), icon: Wallet, testId: "nav-financial", visible: (hasFinancialView(data?.permissions ?? []) || Boolean(data?.isAdmin)) && isAnyFinancialAllowed() },
    { href: "/plans", label: t("plans"), icon: CreditCard, testId: "nav-plans", visible: true },
    { href: "/settings", label: t("settings"), icon: Settings, testId: "nav-settings", visible: true },
  ].filter((item) => item.visible);

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-balsa-overlay backdrop-balsa-overlay"
              onClick={() => onMobileOpenChange?.(false)}
            />
            <aside
              data-testid="sidebar"
              className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[240px] shrink-0 flex-col bg-balsa-inverse text-balsa-inverse-foreground"
            >
              <div data-testid="sidebar-logo" className="flex h-14 items-center justify-between border-b border-balsa-inverse-foreground/15 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-balsa-control bg-balsa-inverse-foreground/10 text-balsa-inverse-foreground shadow-balsa-detail">
                    <span className="text-sm font-bold">S+</span>
                  </div>
                  <span className="font-balsa-title text-sm font-semibold">{APP_NAME}</span>
                </div>
                <Button
                  type="button"
                  variant="text"
                  color="neutral"
                  size="icon"
                  onClick={() => onMobileOpenChange?.(false)}
                  className="text-balsa-inverse-foreground/70 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
                  aria-label={t("closeMenu")}
                >
                  <X size={20} />
                </Button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t("mainNavigation")}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isRouteActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-testid={item.testId}
                      onClick={() => onMobileOpenChange?.(false)}
                      data-balsa="link"
                      className={cn(
                        "relative isolate flex min-h-[44px] items-center gap-3 rounded-balsa-control px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "text-balsa-inverse-foreground"
                          : "text-balsa-inverse-foreground/70 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active-route"
                          className="absolute inset-0 -z-10 rounded-balsa-control bg-balsa-primary/20 shadow-balsa-detail"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 38,
                          }}
                        />
                      )}
                      <Icon className="relative z-10 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-balsa-inverse-foreground/15 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar
                      size="sm"
                      label={userLabel}
                      fallback={userLabel}
                      className="size-7 border-transparent bg-balsa-primary/20 text-balsa-inverse-foreground"
                    />
                    <span className="truncate text-sm text-balsa-inverse-foreground">
                      {userLabel}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="text"
                    color="neutral"
                    size="icon"
                    onClick={() => signOut()}
                    className="text-balsa-inverse-foreground/65 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
                    title={t("signOut")}
                    aria-label={t("signOut")}
                  >
                    <LogOut size={16} />
                  </Button>
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
        "flex h-full shrink-0 flex-col bg-balsa-inverse text-balsa-inverse-foreground transition-[width] duration-balsa-normal",
        isTablet ? "w-16" : "w-[240px]"
      )}
    >
      <div data-testid="sidebar-logo" className={cn("flex h-14 items-center border-b border-balsa-inverse-foreground/15", isTablet ? "justify-center px-2" : "gap-3 px-4")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-balsa-control bg-balsa-inverse-foreground/10 text-balsa-inverse-foreground shadow-balsa-detail">
          <span className="text-sm font-bold">S+</span>
        </div>
        {!isTablet && (
          <span className="font-balsa-title text-sm font-semibold">{APP_NAME}</span>
        )}
      </div>

      <nav className="overflow-y-auto p-3 pb-1 space-y-1" aria-label={t("mainNavigation")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              title={isTablet ? item.label : undefined}
              data-balsa="link"
              className={cn(
                "relative isolate flex items-center gap-3 rounded-balsa-control text-sm font-medium transition-colors",
                isTablet ? "justify-center px-2 py-2" : "px-3 py-2",
                isActive
                  ? "text-balsa-inverse-foreground"
                  : "text-balsa-inverse-foreground/70 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-route"
                  className="absolute inset-0 -z-10 rounded-balsa-control bg-balsa-primary/20 shadow-balsa-detail"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 38,
                  }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" aria-hidden="true" />
              {!isTablet && <span className="relative z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className={cn("border-t border-balsa-inverse-foreground/15 p-3", isTablet && "flex justify-center")}>
        {isTablet ? (
          <Button
            type="button"
            variant="text"
            color="neutral"
            size="icon"
            onClick={() => signOut()}
            className="text-balsa-inverse-foreground/65 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
            title={t("signOut")}
            aria-label={t("signOut")}
          >
            <LogOut size={18} />
          </Button>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                size="sm"
                label={userLabel}
                fallback={userLabel}
                className="size-7 border-transparent bg-balsa-primary/20 text-balsa-inverse-foreground"
              />
              <span className="truncate text-sm text-balsa-inverse-foreground">
                {userLabel}
              </span>
            </div>
            <Button
              type="button"
              variant="text"
              color="neutral"
              size="icon"
              onClick={() => signOut()}
              className="text-balsa-inverse-foreground/65 hover:bg-balsa-inverse-foreground/10 hover:text-balsa-inverse-foreground"
              title={t("signOut")}
              aria-label={t("signOut")}
            >
              <LogOut size={16} />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
