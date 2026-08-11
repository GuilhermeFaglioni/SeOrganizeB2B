import { prisma } from "../../../prisma/client";
import { getEffectivePermissions } from "./authz";

export interface TenantContext {
  tenantId: string | null;
  workspaceStatus: string | null;
  gracePeriodEndsAt: Date | null;
  cancelledAt: Date | null;
  isAdmin: boolean;
}

/**
 * Resolves the tenant context for an authenticated user from their profile
 * and the associated workspace. Used by API routes to derive the `tenantId`
 * they must pass to `withTenant(...)`.
 */
export async function getTenantContext(userId: string): Promise<TenantContext> {
  const effective = await getEffectivePermissions(userId);
  const tenantId = effective.tenantId;
  if (!tenantId) {
    return {
      tenantId: null,
      workspaceStatus: null,
      gracePeriodEndsAt: null,
      cancelledAt: null,
      isAdmin: effective.isAdmin,
    };
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: tenantId },
    select: { status: true, gracePeriodEndsAt: true, cancelledAt: true },
  });
  return {
    tenantId,
    workspaceStatus: workspace?.status ?? null,
    gracePeriodEndsAt: workspace?.gracePeriodEndsAt ?? null,
    cancelledAt: workspace?.cancelledAt ?? null,
    isAdmin: effective.isAdmin,
  };
}
