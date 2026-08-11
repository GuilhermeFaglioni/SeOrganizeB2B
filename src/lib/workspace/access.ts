import type { WorkspaceData } from "@/hooks/use-workspace";
import { isGracePeriodExpired } from "./grace-period";

export type WorkspaceAccessMode = "active" | "grace" | "readonly" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CANCELLED_READONLY_DAYS = 30;

export function getWorkspaceAccessMode(
  workspace: WorkspaceData | null | undefined,
): WorkspaceAccessMode {
  if (!workspace) return "active";
  if (workspace.status === "grace_period") {
    return isGracePeriodExpired(workspace) ? "expired" : "grace";
  }
  if (workspace.status === "cancelled") {
    const endsAt = workspace.gracePeriodEndsAt
      ? new Date(workspace.gracePeriodEndsAt).getTime()
      : null;
    if (endsAt == null || Number.isNaN(endsAt)) return "expired";
    const daysLeft = Math.ceil((endsAt - Date.now()) / DAY_MS);
    if (daysLeft > CANCELLED_READONLY_DAYS) return "expired";
    return "readonly";
  }
  return "active";
}