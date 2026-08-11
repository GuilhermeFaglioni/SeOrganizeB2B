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
  | "calendarEvent"
  | "contract"
  | "client"
  | "proposal"
  | "receivable"
  | "overview";

export type ScopeFilterWhere = Record<string, unknown>;

const ENTITY_RESOURCE: Record<ScopedEntityType, string> = {
  task: "tasks",
  project: "projects",
  document: "documents",
  calendarEvent: "calendar",
  contract: "financial.contracts",
  client: "financial.clients",
  proposal: "financial.proposals",
  receivable: "financial.receivables",
  overview: "financial.overview",
};

/**
 * Financial entities (contracts/clients/proposals/receivables/overview) have no
 * `areaId`/`projectId` in the schema, so area/project scopes cannot be applied
 * to them. Their scope filter falls back to tenant-level filtering (the tenant
 * middleware already scopes rows by tenant).
 */
const TENANT_SCOPED_ENTITIES: ReadonlySet<ScopedEntityType> = new Set<
  ScopedEntityType
>([
  "contract",
  "client",
  "proposal",
  "receivable",
  "overview",
]);

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
 * - Financial entities (contracts/clients/proposals/receivables/overview):
 *   area/project scopes fall back to tenant-level filtering because they have
 *   no area/project linkage in the schema.
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
  if (TENANT_SCOPED_ENTITIES.has(entityType)) {
    // Financial entities have no area/project linkage in the schema, so an
    // area/project scope falls back to tenant-level filtering. The scoped RBAC
    // (area/project) primarily applies to tasks/projects/documents/calendar.
    return baseWhere;
  }
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