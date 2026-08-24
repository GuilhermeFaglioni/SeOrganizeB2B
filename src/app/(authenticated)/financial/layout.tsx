"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import { useAllowedModules } from "@/hooks/use-allowed-modules";
import { replaceWithAIStudioGuard } from "@/lib/ai/studio-router-guard";

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAnyFinancialAllowed } = useAllowedModules();
  const isAIStudio = pathname === "/financial/proposals/templates/ai-studio";

  useEffect(() => {
    if (!isAnyFinancialAllowed()) {
      replaceWithAIStudioGuard(router, "/plans?module=financial");
    }
  }, [isAnyFinancialAllowed, router]);

  return (
    <div className={isAIStudio ? "h-full min-h-0 min-w-0 overflow-hidden" : "h-full overflow-y-auto p-4 sm:p-6"}>
      {!isAIStudio && <FinancialTabs />}
      {children}
    </div>
  );
}
