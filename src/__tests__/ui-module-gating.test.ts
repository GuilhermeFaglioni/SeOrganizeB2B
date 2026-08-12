import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  allowedModulesForWorkspace,
  hasAnyFinancialModule,
  isModuleAllowedForWorkspace,
  moduleForPagePath,
} from "../lib/module-gating";
import type { WorkspaceData } from "../hooks/use-workspace";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

function workspace(allowedModules: string[]): WorkspaceData {
  return {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: null,
    status: "active",
    gracePeriodEndsAt: null,
    plan: { id: "p_1", name: "Starter", allowedModules },
    features: {
      allowedModules,
      limits: {},
      usage: { users: 0, tasks: 0, projects: 0, contracts: 0 },
    },
  };
}

describe("module gating helpers", () => {
  it("allows every module when workspace data is unavailable", () => {
    expect(isModuleAllowedForWorkspace(null, "tasks")).toBe(true);
    expect(
      isModuleAllowedForWorkspace(undefined, "financial.contracts")
    ).toBe(true);
    expect(isModuleAllowedForWorkspace(undefined, "projects")).toBe(true);
  });

  it("blocks every module when the workspace plan allows none", () => {
    const locked = workspace([]);
    expect(allowedModulesForWorkspace(locked)).toEqual([]);
    expect(isModuleAllowedForWorkspace(locked, "tasks")).toBe(false);
    expect(isModuleAllowedForWorkspace(locked, "projects")).toBe(false);
    expect(isModuleAllowedForWorkspace(locked, "financial.contracts")).toBe(
      false
    );
  });

  it("blocks modules missing from the plan allowedModules", () => {
    const ws = workspace(["tasks", "projects"]);
    expect(isModuleAllowedForWorkspace(ws, "tasks")).toBe(true);
    expect(isModuleAllowedForWorkspace(ws, "projects")).toBe(true);
    expect(isModuleAllowedForWorkspace(ws, "calendar")).toBe(false);
    expect(isModuleAllowedForWorkspace(ws, "financial.contracts")).toBe(false);
  });

  it("detects whether any financial module is allowed", () => {
    expect(hasAnyFinancialModule(workspace(["tasks"]))).toBe(false);
    expect(
      hasAnyFinancialModule(workspace(["tasks", "financial.contracts"]))
    ).toBe(true);
    expect(hasAnyFinancialModule(workspace([]))).toBe(false);
  });

  it("maps page paths to modules", () => {
    expect(moduleForPagePath("/")).toBe("tasks");
    expect(moduleForPagePath("/app")).toBe("tasks");
    expect(moduleForPagePath("/board")).toBe("tasks");
    expect(moduleForPagePath("/board/proj_1")).toBe("tasks");
    expect(moduleForPagePath("/projects")).toBe("projects");
    expect(moduleForPagePath("/calendar")).toBe("calendar");
    expect(moduleForPagePath("/documents/doc_1")).toBe("documents");
    expect(moduleForPagePath("/financial/contracts")).toBe("financial");
    expect(moduleForPagePath("/settings")).toBeNull();
    expect(moduleForPagePath("/upgrade")).toBeNull();
    expect(moduleForPagePath("/plans")).toBeNull();
  });
});

describe("sidebar module gating", () => {
  it("filters nav items by allowed modules", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(sidebar).toContain("useAllowedModules");
    expect(sidebar).toContain('isModuleAllowed("tasks")');
    expect(sidebar).toContain('isModuleAllowed("projects")');
    expect(sidebar).toContain('isModuleAllowed("calendar")');
    expect(sidebar).toContain('isModuleAllowed("documents")');
    expect(sidebar).toContain("isAnyFinancialAllowed");
  });
});

describe("upgrade page and route gating", () => {
  it("exists and wraps authenticated routes in a module gate", () => {
    expect(exists("src/app/(authenticated)/upgrade/page.tsx")).toBe(true);
    const layout = read("src/app/(authenticated)/layout.tsx");
    expect(layout).toContain("ModuleGate");
    const gate = read("src/components/layout/module-gate.tsx");
    expect(gate).toContain("/plans?module=");
    expect(gate).toContain("moduleForPagePath");
  });

  it("lists plans and starts a Stripe checkout", () => {
    const page = read("src/app/(authenticated)/upgrade/page.tsx");
    const plansHook = read("src/hooks/use-plans.ts");
    expect(page).toContain("/api/stripe/checkout");
    expect(page).toContain("priceId");
    expect(page).toContain("window.location.href");
    expect(plansHook).toContain("/api/plans");
    expect(plansHook).toContain("usePlans");
  });

  it("gates the financial layout when no financial module is available", () => {
    const layout = read("src/app/(authenticated)/financial/layout.tsx");
    expect(layout).toContain("useAllowedModules");
    expect(layout).toContain("isAnyFinancialAllowed");
    expect(layout).toContain("/plans?module=financial");
  });

  it("exposes the allowed modules hook", () => {
    expect(exists("src/hooks/use-allowed-modules.ts")).toBe(true);
    const hook = read("src/hooks/use-allowed-modules.ts");
    expect(hook).toContain("useAllowedModules");
    expect(hook).toContain("isModuleAllowed");
  });
});

describe("plans endpoint", () => {
  it("serves active plans for checkout", () => {
    expect(exists("src/app/api/plans/route.ts")).toBe(true);
    const route = read("src/app/api/plans/route.ts");
    expect(route).toContain("isActive: true");
    expect(route).toContain("stripePriceId");
    expect(route).toContain("allowedModules");
  });
});