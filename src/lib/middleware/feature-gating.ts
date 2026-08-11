import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import type { TenantContext } from "@/lib/authz/tenant-context";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { checkFeature, checkLimit } from "@/lib/features";
import type { CheckLimitResult } from "@/lib/features";

export const FEATURE_WARNING_HEADER = "x-feature-warning";
export const FEATURE_BLOCKED_CODE = "FEATURE_BLOCKED";
export const LIMIT_REACHED_CODE = "LIMIT_REACHED";

const WARNING_THRESHOLD_RATIO = 0.2;

const MODULE_ROUTES: ReadonlyArray<{ prefix: string; module: string }> = [
  { prefix: "/api/tasks", module: "tasks" },
  { prefix: "/api/projects", module: "projects" },
  { prefix: "/api/calendar", module: "calendar" },
  { prefix: "/api/documents", module: "documents" },
  { prefix: "/api/contracts", module: "financial.contracts" },
  { prefix: "/api/clients", module: "financial.clients" },
  { prefix: "/api/proposals", module: "financial.proposals" },
  { prefix: "/api/receivables", module: "financial.receivables" },
  { prefix: "/api/financial/overview", module: "financial.overview" },
  { prefix: "/api/areas", module: "areas" },
];

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const MODULE_RESOURCES: Record<string, string | null> = {
  tasks: "tasks",
  projects: "projects",
  calendar: "calendarEvents",
  documents: "documents",
  "financial.contracts": "contracts",
  "financial.clients": "clients",
  "financial.proposals": "proposals",
  "financial.receivables": null,
  "financial.overview": null,
  areas: null,
};

export function moduleForPath(pathname: string): string | null {
  for (const { prefix, module: moduleName } of MODULE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return moduleName;
    }
  }
  return null;
}

export function resourceForOp(pathname: string, method: string): string | null {
  if (!WRITE_METHODS.has(method.toUpperCase())) return null;
  const moduleName = moduleForPath(pathname);
  if (!moduleName) return null;
  return MODULE_RESOURCES[moduleName] ?? null;
}

export type FeatureGateDecision =
  | { ok: true }
  | { ok: true; warning: string }
  | {
      ok: false;
      status: 403;
      code: typeof FEATURE_BLOCKED_CODE | typeof LIMIT_REACHED_CODE;
      error: string;
    };

export interface FeatureGateInput {
  userId: string;
  pathname: string;
  method: string;
  tenantContext?: TenantContext;
}

export function upgradeMessage(module: string): string {
  return `The "${module}" module is not included in your current plan. Upgrade your plan to unlock it.`;
}

function limitReachedMessage(resource: string): string {
  return `You have reached the ${resource} limit of your current plan. Upgrade your plan to continue.`;
}

function warningTriggered(result: CheckLimitResult): boolean {
  if (result.behavior !== "warning") return false;
  if (result.remaining <= 0) return true;
  if (Number.isFinite(result.limit) && result.limit > 0) {
    return result.remaining / result.limit < WARNING_THRESHOLD_RATIO;
  }
  return false;
}

export async function enforceFeatureGate({
  userId,
  pathname,
  method,
  tenantContext,
}: FeatureGateInput): Promise<FeatureGateDecision> {
  const moduleName = moduleForPath(pathname);
  if (!moduleName) return { ok: true };

  const ctx = tenantContext ?? (await getTenantContext(userId));
  if (ctx.isAdmin) return { ok: true };
  if (await getSuperAdminStatus(userId)) return { ok: true };

  if (!ctx.tenantId) return { ok: true };

  const allowed = await checkFeature(ctx.tenantId, moduleName);
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      code: FEATURE_BLOCKED_CODE,
      error: upgradeMessage(moduleName),
    };
  }

  const resource = resourceForOp(pathname, method);
  if (!resource) return { ok: true };

  const result = await checkLimit(ctx.tenantId, resource);
  if (result.behavior === "hard" && result.remaining <= 0) {
    return {
      ok: false,
      status: 403,
      code: LIMIT_REACHED_CODE,
      error: limitReachedMessage(resource),
    };
  }
  if (warningTriggered(result)) {
    return { ok: true, warning: `${resource}:${result.remaining}` };
  }
  return { ok: true };
}

export interface ApplyFeatureGateResult {
  response: NextResponse | null;
  warning: string | null;
}

export async function applyFeatureGate(
  input: FeatureGateInput
): Promise<ApplyFeatureGateResult> {
  const decision = await enforceFeatureGate(input);
  if (!decision.ok) {
    return {
      response: NextResponse.json(
        {
          data: null,
          error: { code: decision.code, message: decision.error },
        },
        { status: 403 }
      ),
      warning: null,
    };
  }
  return {
    response: null,
    warning: "warning" in decision ? decision.warning : null,
  };
}

export function withFeatureWarning(
  response: NextResponse,
  warning: string | null
): NextResponse {
  if (warning) response.headers.set(FEATURE_WARNING_HEADER, warning);
  return response;
}