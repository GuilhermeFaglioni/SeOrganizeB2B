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
            data-balsa="link"
            className={cn(
              "flex min-h-[44px] items-center rounded-balsa-control px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-balsa-focus-ring focus-visible:ring-2 focus-visible:ring-balsa-focus-ring/30",
              active
                ? "bg-balsa-primary text-balsa-primary-foreground shadow-balsa-detail"
                : "text-balsa-muted-foreground hover:bg-balsa-muted hover:text-balsa-foreground"
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
