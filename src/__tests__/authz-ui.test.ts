import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("roles and permissioning UI", () => {
  it("exposes the current user's permissions", () => {
    expect(exists("src/app/api/me/permissions/route.ts")).toBe(true);
    expect(exists("src/hooks/use-permissions.ts")).toBe(true);
    const hook = read("src/hooks/use-permissions.ts");
    expect(hook).toContain("/api/me/permissions");
    expect(hook).toContain("isAdmin");
  });

  it("gates the sidebar navigation by module view permissions", () => {
    const sidebar = read("src/components/layout/sidebar.tsx");
    expect(sidebar).toContain('can("tasks.view")');
    expect(sidebar).toContain('can("projects.view")');
    expect(sidebar).toContain('can("calendar.view")');
    expect(sidebar).toContain('can("documents.view")');
    expect(sidebar).toContain("hasFinancialView");
  });

  it("gates the financial tabs by view permissions", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain('permission: "financial.contracts.view"');
    expect(tabs).toContain('permission: "financial.proposals.view"');
    expect(tabs).toContain("useCan");
  });

  it("gates the settings cards by role", () => {
    const settings = read("src/app/(authenticated)/settings/page.tsx");
    expect(settings).toContain('can("manage_roles")');
    expect(settings).toContain('href: "/settings/roles"');
  });

  it("keeps the roles management routes and page present", () => {
    for (const page of [
      "src/app/(authenticated)/settings/roles/page.tsx",
      "src/app/api/roles/route.ts",
      "src/app/api/roles/default/route.ts",
      "src/app/api/team/route.ts",
      "src/app/api/profiles/[id]/role/route.ts",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("renders the permission matrix from the catalog", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("MODULES");
    expect(manager).toContain("SPECIAL_PERMISSIONS");
    expect(manager).toContain("useTranslations(\"roles.permissions\")");
  });

  it("team page assigns roles to members", () => {
    const team = read("src/app/(authenticated)/settings/team/page.tsx");
    const hook = read("src/hooks/use-roles.ts");
    expect(team).toContain("useTeam");
    expect(team).toContain("useAssignRole");
    expect(team).toContain("roleLabel");
    expect(hook).toContain("/api/team");
  });

  it("prisma schema defines Role and Profile.roleId", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toContain("model Role {");
    expect(schema).toContain("roleId    String?  @map(\"role_id\")");
    expect(schema).toContain("defaultRoleId String?  @map(\"default_role_id\")");
  });
});
