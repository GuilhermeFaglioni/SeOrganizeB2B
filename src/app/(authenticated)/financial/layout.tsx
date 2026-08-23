"use client";

import { useRouter } from "next/navigation";
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
  const { isAnyFinancialAllowed } = useAllowedModules();

  useEffect(() => {
    if (!isAnyFinancialAllowed()) {
      replaceWithAIStudioGuard(router, "/plans?module=financial");
    }
  }, [isAnyFinancialAllowed, router]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <FinancialTabs />
      {children}
    </div>
  );
}
