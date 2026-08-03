"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/use-permissions";

const TABS = [
  { href: "/financial", labelKey: "overview", exact: true, permission: "financial.overview.view" },
  { href: "/financial/contracts", labelKey: "contracts", permission: "financial.contracts.view" },
  { href: "/financial/proposals", labelKey: "proposals", permission: "financial.proposals.view" },
  { href: "/financial/receivables", labelKey: "receivables", permission: "financial.receivables.view" },
  { href: "/financial/clients", labelKey: "clients", permission: "financial.clients.view" },
];

export function FinancialTabs() {
  const pathname = usePathname();
  const t = useTranslations("financial.tabs");
  const { can } = useCan();
  const visibleTabs = TABS.filter((tab) => can(tab.permission));
  return (
    <nav aria-label={t("sections")} className="mb-4 flex flex-wrap gap-1">
      {visibleTabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
              active
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
