export type PermissionScope = "all" | "area" | "project";

export interface ScopedPermission {
  resource: string;
  action: string;
  scope: PermissionScope;
}

export const ACTION_PERMISSIONS = ["view", "create", "edit", "delete"] as const;

export const MODULES: Record<string, readonly string[]> = {
  tasks: ["view", "create", "edit", "delete"],
  projects: ["view", "create", "edit", "delete"],
  calendar: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "edit", "delete"],
  "financial.overview": ["view"],
  "financial.contracts": ["view", "create", "edit", "delete"],
  "financial.proposals": ["view", "create", "edit", "delete"],
  "financial.clients": ["view", "create", "edit", "delete"],
  "financial.receivables": ["view", "create", "edit", "delete"],
  areas: ["view", "create", "edit", "delete"],
} as const;

export const SPECIAL_PERMISSIONS = [
  "financial.contracts.lifecycle",
  "financial.contracts.adjustValue",
  "financial.receivables.markPaid",
  "financial.receivables.refund",
  "financial.proposals.send",
  "financial.proposals.acceptReject",
  "financial.proposals.clone",
  "financial.proposals.manageTemplates",
  "manage_roles",
] as const;

export function allPermissions(): string[] {
  const modulePermissions: string[] = [];
  for (const [module, actions] of Object.entries(MODULES)) {
    for (const action of actions) {
      modulePermissions.push(`${module}.${action}`);
    }
  }
  return [...modulePermissions, ...SPECIAL_PERMISSIONS];
}

/**
 * All catalogued permissions as scoped permissions with the widest scope
 * (`all`). Used to seed the Admin role.
 */
export function allScopedPermissions(): ScopedPermission[] {
  return allPermissions().map((key) => {
    const dot = key.lastIndexOf(".");
    if (dot === -1) {
      return { resource: "", action: key, scope: "all" };
    }
    return {
      resource: key.slice(0, dot),
      action: key.slice(dot + 1),
      scope: "all",
    };
  });
}

const VALID = new Set<string>(allPermissions());

export function isValidPermission(key: string): boolean {
  return VALID.has(key);
}

export function isPermissionScope(value: unknown): value is PermissionScope {
  return value === "all" || value === "area" || value === "project";
}

/**
 * Reconstructs the legacy `resource.action` key from a scoped permission.
 * Single-token special permissions (e.g. `manage_roles`) are stored with an
 * empty `resource` so the original key round-trips unchanged.
 */
export function permissionKey(permission: ScopedPermission): string {
  return permission.resource
    ? `${permission.resource}.${permission.action}`
    : permission.action;
}

/**
 * Normalizes a stored `Role.permissions` JSON value into the scoped format.
 * Legacy `"resource.action"` strings are converted to
 * `{ resource, action, scope: "all" }`; object entries pass through after
 * validation. Invalid entries are dropped and duplicates are removed.
 */
export function normalizePermissions(raw: unknown): ScopedPermission[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: ScopedPermission[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (!isValidPermission(item) || seen.has(item)) continue;
      seen.add(item);
      const dot = item.lastIndexOf(".");
      if (dot === -1) {
        result.push({ resource: "", action: item, scope: "all" });
      } else {
        result.push({
          resource: item.slice(0, dot),
          action: item.slice(dot + 1),
          scope: "all",
        });
      }
      continue;
    }
    if (item && typeof item === "object") {
      const candidate = item as Record<string, unknown>;
      const resource = typeof candidate.resource === "string" ? candidate.resource : "";
      const action = typeof candidate.action === "string" ? candidate.action : "";
      const scope = isPermissionScope(candidate.scope) ? candidate.scope : "all";
      const key = permissionKey({ resource, action, scope });
      if (!isValidPermission(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ resource, action, scope });
    }
  }
  return result;
}

/**
 * Validates and sanitizes a permission list (legacy strings or scoped
 * objects) into the canonical scoped format.
 */
export function sanitizePermissions(keys: unknown): ScopedPermission[] {
  return normalizePermissions(keys);
}

export function hasFinancialView(
  permissions: readonly (string | ScopedPermission)[]
): boolean {
  const financialModules = Object.keys(MODULES).filter((module) =>
    module.startsWith("financial")
  );
  return financialModules.some((module) =>
    permissions.some((permission) => {
      const key =
        typeof permission === "string" ? permission : permissionKey(permission);
      return key === `${module}.view`;
    })
  );
}

export const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001";