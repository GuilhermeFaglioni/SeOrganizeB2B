export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export const WORKSPACE_CANCELLED_GRACE_DAYS = 30;

export interface WorkspaceAccessInfo {
  status: string | null;
  cancelledAt: Date | null;
}

/**
 * Whether a workspace is hard-blocked for authenticated use.
 * A cancelled workspace is usable for a grace period of 30 days after
 * cancellation; beyond that access is denied. grace_period/active allow access
 * (the AuthGate shows the relevant banner from /api/workspace).
 */
export function isWorkspaceAccessBlocked(
  workspace: WorkspaceAccessInfo
): boolean {
  if (workspace.status !== "cancelled") return false;
  if (!workspace.cancelledAt) return true;
  const daysSinceCancellation =
    (Date.now() - workspace.cancelledAt.getTime()) / 86_400_000;
  return daysSinceCancellation > WORKSPACE_CANCELLED_GRACE_DAYS;
}
