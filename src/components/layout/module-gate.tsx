"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAllowedModules } from "@/hooks/use-allowed-modules";
import { moduleForPagePath } from "@/lib/module-gating";

export function ModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isModuleAllowed, isAnyFinancialAllowed } = useAllowedModules();

  const moduleName = moduleForPagePath(pathname);
  const blocked = moduleName
    ? moduleName === "financial"
      ? !isAnyFinancialAllowed()
      : !isModuleAllowed(moduleName)
    : false;

  useEffect(() => {
    if (blocked && moduleName) {
      router.replace(`/plans?module=${encodeURIComponent(moduleName)}`);
    }
  }, [blocked, moduleName, router]);

  if (blocked) return null;
  return <>{children}</>;
}