import type { WorkspaceData } from "@/hooks/use-workspace";

type GraceWorkspace = Pick<WorkspaceData, "status" | "gracePeriodEndsAt">;

export function isGracePeriodExpired(
  workspace: GraceWorkspace | null | undefined
): boolean {
  if (!workspace || workspace.status !== "grace_period") return false;
  if (!workspace.gracePeriodEndsAt) return false;
  const endsAt = new Date(workspace.gracePeriodEndsAt).getTime();
  if (Number.isNaN(endsAt)) return false;
  return endsAt < Date.now();
}