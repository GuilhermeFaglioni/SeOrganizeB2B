import {
  MODULES,
  SPECIAL_PERMISSIONS,
  permissionKey,
  type PermissionScope,
  type ScopedPermission,
} from "./permissions";

export const SCOPE_OPTIONS: readonly PermissionScope[] = ["all", "area", "project"];

/**
 * Editor state: a map of `resource.action` (or single-token special
 * permission) keys to their selected scope. Only enabled permissions are
 * present in the map.
 */
export type ScopeMap = Record<string, PermissionScope>;

export function initialScopeMap(permissions: ScopedPermission[]): ScopeMap {
  const state: ScopeMap = {};
  for (const permission of permissions) {
    state[permissionKey(permission)] = permission.scope;
  }
  return state;
}

export function buildScopedPermissions(state: ScopeMap): ScopedPermission[] {
  const result: ScopedPermission[] = [];
  for (const [key, scope] of Object.entries(state)) {
    const dot = key.lastIndexOf(".");
    if (dot === -1) {
      result.push({ resource: "", action: key, scope });
    } else {
      result.push({ resource: key.slice(0, dot), action: key.slice(dot + 1), scope });
    }
  }
  return result;
}

export function togglePermission(state: ScopeMap, key: string): ScopeMap {
  const next = { ...state };
  if (key in next) {
    delete next[key];
  } else {
    next[key] = "all";
  }
  return next;
}

export function setPermissionScope(
  state: ScopeMap,
  key: string,
  scope: PermissionScope
): ScopeMap {
  if (!(key in state)) return state;
  return { ...state, [key]: scope };
}

export function moduleHasAny(
  state: ScopeMap,
  module: string,
  actions: readonly string[]
): boolean {
  return actions.some((action) => `${module}.${action}` in state);
}

export function moduleAllSelected(
  state: ScopeMap,
  module: string,
  actions: readonly string[]
): boolean {
  return actions.every((action) => `${module}.${action}` in state);
}

export function toggleModule(
  state: ScopeMap,
  module: string,
  actions: readonly string[]
): ScopeMap {
  const allSelected = moduleAllSelected(state, module, actions);
  const next = { ...state };
  for (const action of actions) {
    const key = `${module}.${action}`;
    if (allSelected) {
      delete next[key];
    } else if (!(key in next)) {
      next[key] = "all";
    }
  }
  return next;
}

export interface PreviewResource {
  resource: string;
  scope: PermissionScope;
  kind: "module" | "special";
}

const SCOPE_RANK: Record<PermissionScope, number> = { all: 3, area: 2, project: 1 };

export function widestScope(scopes: readonly PermissionScope[]): PermissionScope {
  return scopes.reduce<PermissionScope>(
    (best, scope) => (SCOPE_RANK[scope] > SCOPE_RANK[best] ? scope : best),
    "project"
  );
}

/**
 * Resources visible to a user holding these permissions. A module is visible
 * when any of its actions is enabled; the badge shows the widest scope among
 * the enabled actions. Special permissions are listed separately and never
 * count as module visibility.
 */
export function previewResources(permissions: ScopedPermission[]): PreviewResource[] {
  const moduleScopes: Record<string, PermissionScope[]> = {};
  const specials = new Map<string, PermissionScope>();

  for (const permission of permissions) {
    const key = permissionKey(permission);
    if ((SPECIAL_PERMISSIONS as readonly string[]).includes(key)) {
      specials.set(key, permission.scope);
      continue;
    }
    const resource = permission.resource;
    if (resource && resource in MODULES) {
      moduleScopes[resource] = moduleScopes[resource] ?? [];
      moduleScopes[resource].push(permission.scope);
    }
  }

  const modules: PreviewResource[] = (Object.keys(MODULES) as string[])
    .filter((resource) => moduleScopes[resource])
    .map((resource) => ({
      resource,
      scope: widestScope(moduleScopes[resource]),
      kind: "module",
    }));

  const specialList: PreviewResource[] = (SPECIAL_PERMISSIONS as readonly string[])
    .filter((permission) => specials.has(permission))
    .map((permission) => ({
      resource: permission,
      scope: specials.get(permission) as PermissionScope,
      kind: "special",
    }));

  return [...modules, ...specialList];
}

/** True when `name` collides (case-insensitive) with an existing role name. */
export function findNameConflict(name: string, otherRoleNames: string[]): boolean {
  const normalized = name.trim().toLowerCase();
  return otherRoleNames.some((existing) => existing.trim().toLowerCase() === normalized);
}
