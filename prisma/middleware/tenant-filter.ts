import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";

export const TENANT_CONTEXT_REQUIRED = "TENANT_CONTEXT_REQUIRED";

export class TenantContextRequiredError extends Error {
  readonly code: string = TENANT_CONTEXT_REQUIRED;

  constructor(model: string, action: string) {
    super(
      `${TENANT_CONTEXT_REQUIRED}: model "${model}" action "${action}" ran without a tenant context. ` +
        `Wrap the call in withTenant(tenantId, ...) for user requests, or withTenantBypass(...) for system/super-admin access.`
    );
    this.name = "TenantContextRequiredError";
  }
}

type TenantFilterContext = {
  tenantId: string | null;
  bypass: boolean;
};

const storage = new AsyncLocalStorage<TenantFilterContext>();

export function getTenantContext(): TenantFilterContext | undefined {
  return storage.getStore();
}

export function getTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

/**
 * Returns the active tenantId for code that must fill in a `tenantId` on data
 * the middleware cannot inject itself (nested creates, `createMany` rows).
 * Fails loudly when no tenant context is active instead of silently writing
 * NULL tenant rows.
 */
export function requireTenantId(context: string): string {
  const tenantId = storage.getStore()?.tenantId ?? null;
  if (!tenantId) {
    throw new TenantContextRequiredError(context, "tenant-required");
  }
  return tenantId;
}

/**
 * Runs `fn` with the given tenantId visible to the Prisma middleware.
 *
 * IMPORTANT: `fn` may be sync or async — it is awaited inside the tenant
 * context so Prisma's deferred query execution (its promises are thenables
 * that start running on the first `.then`) always sees the context.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: () => T | Promise<T>
): Promise<T> {
  return storage.run({ tenantId, bypass: false }, async () => fn());
}

export async function withTenantBypass<T>(fn: () => T | Promise<T>): Promise<T> {
  return storage.run({ tenantId: null, bypass: true }, async () => fn());
}

/**
 * Models that carry a `tenantId` column but must NOT be filtered by this
 * middleware:
 *  - Profile   -> scoped by profileId (its own primary key)
 *  - Workspace -> the tenant table itself
 *  - Plan      -> global catalog
 *  - PlanLimit -> global catalog
 *  - Invite    -> has NO tenantId column; scoped by workspaceId (the tenant
 *                 itself), so it must not receive a tenantId filter either.
 *  - ReadOnlyAccess -> has NO tenantId column; scoped by its bearer token.
 *  - WorkspaceBindingAttempt -> scoped by authenticated user ID before a
 *                 Profile exists, so it must not receive a tenantId filter.
 *  - Closed Beta models -> global campaign records protected by their own
 *                 server-side admin/domain boundaries.
 * Everything else with a `tenantId` column is tenant-scoped.
 */
const EXEMPT_MODELS = new Set([
  "Profile",
  "Workspace",
  "Plan",
  "PlanLimit",
  "Invite",
  "ReadOnlyAccess",
  "WorkspaceBindingAttempt",
  "ClosedBetaConfig",
  "ClosedBetaEnrollment",
  "ClosedBetaInvitation",
  "ClosedBetaAuditEvent",
  "ClosedBetaRateLimit",
  "ClosedBetaCheckinEdition",
  "ClosedBetaCheckinQuestion",
  "ClosedBetaCheckinResponse",
  "ClosedBetaCheckinWorkspaceState",
]);

/**
 * Actions that can read/write rows scoped to a tenant. `createMany` /
 * `createManyAndReturn` are deliberately NOT intercepted (out of scope for
 * T-014); system code must use withTenantBypass around them anyway.
 */
const INTERCEPTED_ACTIONS = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Optional per-call opt-outs a caller can attach to `args` (e.g. a
 * super-admin route that deliberately crosses tenants). Both names are
 * honoured and stripped from `args` before the query is dispatched so Prisma
 * never sees an unknown argument.
 */
const BYPASS_FLAGS = ["bypassTenantFilter", "_skipTenantFilter"];

function stripBypassFlags(args: Record<string, unknown>): void {
  for (const flag of BYPASS_FLAGS) {
    delete args[flag];
  }
}

function mergeTenantWhere(
  where: unknown,
  tenantId: string
): Record<string, unknown> {
  const base =
    where && typeof where === "object" && !Array.isArray(where)
      ? (where as Record<string, unknown>)
      : {};
  return { ...base, tenantId };
}

/**
 * Prisma middleware ($use) that guarantees tenant isolation for every
 * tenant-scoped model. Exported as a named function so tests can invoke it
 * with fabricated params.
 */
export const tenantFilter: Prisma.Middleware = async (params, next) => {
  if (!params || !params.model || !params.action) {
    return next(params);
  }
  if (!INTERCEPTED_ACTIONS.has(params.action)) {
    return next(params);
  }
  if (EXEMPT_MODELS.has(params.model)) {
    return next(params);
  }

  // Prisma passes `args: undefined` for argless calls such as
  // `findMany()`, `count()` or `deleteMany()`. Normalize to `{}` instead of
  // skipping, otherwise those queries would escape tenant filtering.
  if (!params.args || typeof params.args !== "object") {
    params.args = {};
  }

  const args = params.args as Record<string, unknown>;

  if (
    storage.getStore()?.bypass === true ||
    BYPASS_FLAGS.some((flag) => args[flag] === true)
  ) {
    stripBypassFlags(args);
    return next(params);
  }

  const tenantId = storage.getStore()?.tenantId ?? null;
  if (!tenantId) {
    throw new TenantContextRequiredError(params.model, params.action);
  }

  stripBypassFlags(args);

  switch (params.action) {
    case "findUnique":
      // findUnique requires a unique `where`; a bare `{ id }` cannot carry a
      // tenant filter. Transform into a tenant-scoped findFirst.
      params.action = "findFirst";
      args.where = { AND: [args.where ?? {}, { tenantId }] };
      break;
    case "create":
      if (args.data && typeof args.data === "object") {
        (args.data as Record<string, unknown>).tenantId = tenantId;
      }
      break;
    case "upsert":
      args.where = mergeTenantWhere(args.where, tenantId);
      if (args.create && typeof args.create === "object") {
        (args.create as Record<string, unknown>).tenantId = tenantId;
      }
      break;
    case "findMany":
    case "findFirst":
    case "update":
    case "updateMany":
    case "delete":
    case "deleteMany":
    case "count":
    case "aggregate":
    case "groupBy":
      args.where = mergeTenantWhere(args.where, tenantId);
      break;
  }

  return next(params);
};
