"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAllowedModules } from "@/hooks/use-allowed-modules";
import { moduleForPagePath } from "@/lib/module-gating";
import {
  replaceWithAIStudioGuard,
  shouldPreserveAIStudioParentChildren,
} from "@/lib/ai/studio-router-guard";

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
  const [redirecting, setRedirecting] = useState(false);
  const hasRenderedChildren = useRef(false);

  useEffect(() => {
    if (!blocked || !moduleName) {
      setRedirecting(false);
      return;
    }
    setRedirecting(replaceWithAIStudioGuard(router, `/plans?module=${encodeURIComponent(moduleName)}`));
  }, [blocked, moduleName, router]);

  if (!blocked) {
    hasRenderedChildren.current = true;
    return <>{children}</>;
  }
  if (!shouldPreserveAIStudioParentChildren({ hasRenderedChildren: hasRenderedChildren.current, redirecting, sameIdentity: true })) return null;
  return <>{children}</>;
}
