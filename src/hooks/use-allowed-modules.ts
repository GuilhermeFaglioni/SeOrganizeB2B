import { useCallback, useMemo } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import {
  FINANCIAL_MODULES,
  allowedModulesForWorkspace,
} from "@/lib/module-gating";

export function useAllowedModules() {
  const { data: workspace } = useWorkspace();
  const { data: permissions } = usePermissions();

  const isAdmin = permissions?.isAdmin ?? false;

  const allowedModules = useMemo(() => {
    return new Set<string>(allowedModulesForWorkspace(workspace));
  }, [workspace]);

  const isModuleAllowed = useCallback(
    (module: string) => allowedModules.has(module),
    [allowedModules]
  );

  const isAnyFinancialAllowed = useCallback(
    () => FINANCIAL_MODULES.some((module) => allowedModules.has(module)),
    [allowedModules]
  );

  return { allowedModules, isModuleAllowed, isAnyFinancialAllowed, isAdmin };
}