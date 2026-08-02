"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/financial", label: "Overview", exact: true },
  { href: "/financial/contracts", label: "Contracts" },
  { href: "/financial/receivables", label: "Receivables" },
  { href: "/financial/clients", label: "Clients" },
];

export function FinancialTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Financial sections" className="mb-4 flex flex-wrap gap-1" role="tablist">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
              active
                ? "bg-accent text-white"
                : "text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
