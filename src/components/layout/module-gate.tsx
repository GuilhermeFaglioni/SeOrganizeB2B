"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAllowedModules } from "@/hooks/use-allowed-modules";
import { moduleForPagePath } from "@/lib/module-gating";

export function ModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isModuleAllowed, isAnyFinancialAllowed } = useAllowedModules();

  useEffect(() => {
    const moduleName = moduleForPagePath(pathname);
    if (!moduleName) return;
    const blocked =
      moduleName === "financial"
        ? !isAnyFinancialAllowed()
        : !isModuleAllowed(moduleName);
    if (blocked) {
      router.replace(`/plans?module=${encodeURIComponent(moduleName)}`);
    }
  }, [pathname, isModuleAllowed, isAnyFinancialAllowed, router]);

  return <>{children}</>;
}