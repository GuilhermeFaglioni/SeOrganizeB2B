import {
  getEffectivePermissions,
  getUserAreaIds,
  getUserProjectIds,
} from "./authz";
import type { PermissionScope } from "./permissions";

export type ScopedEntityType =
  | "task"
  | "project"
  | "document"
  | "calendarEvent";

export type ScopeFilterWhere = Record<string, unknown>;

const ENTITY_RESOURCE: Record<ScopedEntityType, string> = {
  task: "tasks",
  project: "projects",
  document: "documents",
  calendarEvent: "calendar",
};

/**
 * Resolves the effective scope a user is granted for an entity type, based on
 * their `view` permission. Admins are always treated as `all`. When no `view`
 * permission exists the caller's `denyFor` guard has already rejected the
 * request, so the safe default is `all` (no additional filtering).
 */
export async function getUserScope(
  userId: string,
  _tenantId: string | null,
  entityType: ScopedEntityType
): Promise<PermissionScope> {
  const effective = await getEffectivePermissions(userId);
  if (effective.isAdmin) return "all";
  const resource = ENTITY_RESOURCE[entityType];
  const permission = effective.permissions.find(
    (p) => p.resource === resource && p.action === "view"
  );
  return permission?.scope ?? "all";
}

/**
 * Augments a Prisma `where` with the scope filter for the user's effective
 * permission scope on the given entity type:
 *
 * - `all`: unchanged (the tenant filter middleware already scopes by tenant).
 * - `area`: projects/calendarEvents match `areaId` in the user's areas;
 *   tasks/documents match through their `project.areaId`.
 * - `project`: tasks/documents match `projectId` in the user's project
 *   memberships.
 *
 * An empty membership list produces `{ in: [] }`, which matches nothing.
 */
export async function applyScopeFilter(
  userId: string,
  tenantId: string | null,
  entityType: ScopedEntityType,
  baseWhere: ScopeFilterWhere = {}
): Promise<ScopeFilterWhere> {
  const scope = await getUserScope(userId, tenantId, entityType);
  if (scope === "all") return baseWhere;
  if (scope === "area") {
    const areaIds = await getUserAreaIds(userId, tenantId);
    if (entityType === "task" || entityType === "document") {
      return { ...baseWhere, project: { areaId: { in: areaIds } } };
    }
    return { ...baseWhere, areaId: { in: areaIds } };
  }
  const projectIds = await getUserProjectIds(userId, tenantId);
  if (entityType === "task" || entityType === "document") {
    return { ...baseWhere, projectId: { in: projectIds } };
  }
  return baseWhere;
}