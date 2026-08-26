import type { WorkspaceData } from "@/hooks/use-workspace";

export const ALL_MODULES = [
  "tasks",
  "projects",
  "calendar",
  "documents",
  "financial.overview",
  "financial.contracts",
  "financial.proposals",
  "financial.clients",
  "financial.receivables",
  "areas",
  "ai_studio",
] as const;

export const FINANCIAL_MODULES = [
  "financial.overview",
  "financial.contracts",
  "financial.proposals",
  "financial.clients",
  "financial.receivables",
] as const;

const PAGE_MODULE_ROUTES: ReadonlyArray<{ prefix: string; module: string }> = [
  { prefix: "/app", module: "tasks" },
  { prefix: "/board", module: "tasks" },
  { prefix: "/all", module: "tasks" },
  { prefix: "/projects", module: "projects" },
  { prefix: "/calendar", module: "calendar" },
  { prefix: "/documents", module: "documents" },
  { prefix: "/financial", module: "financial" },
];

export function moduleForPagePath(pathname: string): string | null {
  if (pathname === "/" || pathname === "/app") return "tasks";
  for (const { prefix, module: moduleName } of PAGE_MODULE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return moduleName;
    }
  }
  return null;
}

export function allowedModulesForWorkspace(
  workspace: WorkspaceData | null | undefined
): string[] {
  if (!workspace) return [...ALL_MODULES];
  return workspace.features.allowedModules ?? workspace.plan?.allowedModules ?? [];
}

export function isModuleAllowedForWorkspace(
  workspace: WorkspaceData | null | undefined,
  module: string
): boolean {
  return allowedModulesForWorkspace(workspace).includes(module);
}

export function hasAnyFinancialModule(
  workspace: WorkspaceData | null | undefined
): boolean {
  return FINANCIAL_MODULES.some((module) =>
    isModuleAllowedForWorkspace(workspace, module)
  );
}
