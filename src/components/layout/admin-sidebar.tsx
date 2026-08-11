"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

function isRouteActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("admin.sidebar");

  const navItems = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard, testId: "admin-nav-dashboard" },
    { href: "/admin/tenants", label: t("tenants"), icon: Building2, testId: "admin-nav-tenants" },
    { href: "/admin/plans", label: t("plans"), icon: Receipt, testId: "admin-nav-plans" },
    { href: "/admin/billing", label: t("billing"), icon: Wallet, testId: "admin-nav-billing" },
    { href: "/admin/support", label: t("support"), icon: LifeBuoy, testId: "admin-nav-support" },
  ];

  return (
    <aside
      data-testid="admin-sidebar"
      className="flex h-full w-[240px] shrink-0 flex-col bg-sidebar"
    >
      <div
        data-testid="admin-sidebar-logo"
        className="flex h-14 items-center gap-3 border-b border-sidebar-divider px-4"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-page-alt text-sidebar shadow-sm">
          <span className="text-sm font-bold">S+</span>
        </div>
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-sidebar-text">
            {APP_NAME}
          </span>
          <span className="block truncate text-xs text-sidebar-text-muted">
            {t("label")}
          </span>
        </div>
      </div>
      <nav
        className="flex-1 space-y-1 overflow-y-auto p-3"
        aria-label={t("navigation")}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                "relative isolate flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-sidebar-text"
                  : "text-sidebar-text-muted hover:bg-sidebar-hover"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
