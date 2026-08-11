import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildScopedPermissions,
  findNameConflict,
  initialScopeMap,
  moduleAllSelected,
  moduleHasAny,
  previewResources,
  SCOPE_OPTIONS,
  setPermissionScope,
  toggleModule,
  togglePermission,
} from "../lib/authz/role-editor";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("role editor scope state", () => {
  it("SCOPE_OPTIONS contains all/area/project", () => {
    expect(SCOPE_OPTIONS).toEqual(["all", "area", "project"]);
  });

  it("initialScopeMap keys by permissionKey with their scope", () => {
    expect(
      initialScopeMap([
        { resource: "tasks", action: "view", scope: "all" },
        { resource: "financial.contracts", action: "edit", scope: "area" },
        { resource: "", action: "manage_roles", scope: "all" },
      ])
    ).toEqual({
      "tasks.view": "all",
      "financial.contracts.edit": "area",
      manage_roles: "all",
    });
  });

  it("buildScopedPermissions round-trips the map into scoped objects", () => {
    expect(
      buildScopedPermissions({
        "tasks.view": "all",
        "financial.contracts.edit": "project",
        manage_roles: "all",
      })
    ).toEqual([
      { resource: "tasks", action: "view", scope: "all" },
      { resource: "financial.contracts", action: "edit", scope: "project" },
      { resource: "", action: "manage_roles", scope: "all" },
    ]);
  });

  it("togglePermission enables with default scope all and removes when on", () => {
    let state = togglePermission({}, "tasks.view");
    expect(state).toEqual({ "tasks.view": "all" });
    state = togglePermission(state, "tasks.view");
    expect(state).toEqual({});
  });

  it("setPermissionScope only updates existing keys", () => {
    expect(setPermissionScope({ "tasks.view": "all" }, "tasks.view", "area")).toEqual({
      "tasks.view": "area",
    });
    expect(setPermissionScope({}, "tasks.view", "area")).toEqual({});
  });

  it("toggleModule selects every action on empty and clears when full", () => {
    const actions = ["view", "create"] as const;
    let state = toggleModule({}, "tasks", actions);
    expect(state).toEqual({ "tasks.view": "all", "tasks.create": "all" });
    state = toggleModule(state, "tasks", actions);
    expect(state).toEqual({});
  });

  it("moduleHasAny and moduleAllSelected describe module selection", () => {
    const actions = ["view", "create"] as const;
    expect(moduleHasAny({ "tasks.view": "all" }, "tasks", actions)).toBe(true);
    expect(moduleAllSelected({ "tasks.view": "all" }, "tasks", actions)).toBe(false);
    expect(
      moduleAllSelected({ "tasks.view": "all", "tasks.create": "area" }, "tasks", actions)
    ).toBe(true);
  });
});

describe("role editor preview", () => {
  it("shows no resources for an empty permission set", () => {
    expect(previewResources([])).toEqual([]);
  });

  it("shows a module when any action is enabled", () => {
    expect(
      previewResources([{ resource: "tasks", action: "create", scope: "all" }])
    ).toEqual([{ resource: "tasks", scope: "all", kind: "module" }]);
  });

  it("uses the widest enabled scope as the module badge", () => {
    expect(
      previewResources([
        { resource: "tasks", action: "view", scope: "area" },
        { resource: "tasks", action: "edit", scope: "project" },
      ])
    ).toEqual([{ resource: "tasks", scope: "area", kind: "module" }]);
  });

  it("lists special permissions separately without implying module visibility", () => {
    expect(
      previewResources([
        { resource: "financial.contracts", action: "lifecycle", scope: "all" },
        { resource: "", action: "manage_roles", scope: "all" },
      ])
    ).toEqual([
      { resource: "financial.contracts.lifecycle", scope: "all", kind: "special" },
      { resource: "manage_roles", scope: "all", kind: "special" },
    ]);
  });

  it("orders modules by catalog order then special permissions", () => {
    expect(
      previewResources([
        { resource: "projects", action: "view", scope: "all" },
        { resource: "tasks", action: "view", scope: "project" },
      ]).map((item) => item.resource)
    ).toEqual(["tasks", "projects"]);
  });
});

describe("role name validation", () => {
  it("detects a duplicate name ignoring case and whitespace", () => {
    expect(findNameConflict("Financeiro", ["financEiro", "Admin"])).toBe(true);
    expect(findNameConflict("  Financeiro  ", ["Financeiro"])).toBe(true);
    expect(findNameConflict("Viewer", ["Financeiro", "Admin"])).toBe(false);
    expect(findNameConflict("", ["Financeiro"])).toBe(false);
  });
});

describe("roles UI wiring", () => {
  it("types role permissions as scoped permissions in the hooks", () => {
    const hook = read("src/hooks/use-roles.ts");
    expect(hook).toContain("permissions: ScopedPermission[]");
    expect(hook).toContain('import type { ScopedPermission } from "@/lib/authz/permissions"');
    expect(hook).toContain("mutationFn: (data: { name: string; permissions: ScopedPermission[] })");
    expect(hook).toContain("permissions?: ScopedPermission[]");
  });

  it("renders a scope dropdown with all/area/project options in the editor", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("SCOPE_OPTIONS");
    expect(manager).toContain('t(`scope.${scope}`)');
    expect(manager).toContain('value={scopeMap[key]}');
    expect(manager).toContain("buildScopedPermissions");
    expect(manager).toContain("initialScopeMap");
  });

  it("renders a preview panel that reflects the current selection", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("previewResources");
    expect(manager).toContain('t("previewTitle")');
    expect(manager).toContain('t("previewHint")');
    expect(manager).toContain('t("previewEmpty")');
  });

  it("surfaces duplicate name validation before submitting", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("findNameConflict");
    expect(manager).toContain('t("nameExists")');
    expect(manager).toContain('existingNames={data');
  });

  it("locks the admin role: read-only editor, no edit/delete actions", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("role.isAdmin");
    expect(manager).toContain("readOnly");
    expect(manager).toContain('t("adminLocked")');
    expect(manager).toContain('disabled={readOnly}');
  });

  it("submits the scoped permission payload to the roles API", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    const hook = read("src/hooks/use-roles.ts");
    expect(manager).toContain("updateRole.mutateAsync({ id: editor.role.id, name, permissions }");
    expect(manager).toContain("createRole.mutateAsync({ name, permissions }");
    expect(hook).toContain('fetchJson("/api/roles"');
    expect(hook).toContain("method: \"PATCH\"");
  });

  it("keeps the catalog and special permissions as the source of the matrix", () => {
    const manager = read("src/components/settings/roles-manager.tsx");
    expect(manager).toContain("MODULES");
    expect(manager).toContain("SPECIAL_PERMISSIONS");
    expect(manager).toContain('useTranslations("roles.permissions")');
  });

  it("adds editor scope/preview i18n keys in both locales", () => {
    const pt = read("messages/pt-BR.json");
    const en = read("messages/en.json");
    for (const key of [
      '"scopeLabel"',
      '"previewTitle"',
      '"previewHint"',
      '"previewEmpty"',
      '"adminLocked"',
      '"nameExists"',
      '"titleView"',
    ]) {
      expect(pt).toContain(key);
      expect(en).toContain(key);
    }
  });
});
