import type { WorkspaceLimit } from "@/hooks/use-workspace";

export const WARNING_THRESHOLD_RATIO = 0.2;

export interface WarningLimit {
  resource: string;
  limit: number;
  remaining: number;
  used: number;
}

export function isWarningLimit(
  limit: number,
  remaining: number,
  behavior: string
): boolean {
  if (behavior !== "warning") return false;
  if (remaining <= 0) return true;
  if (Number.isFinite(limit) && limit > 0) {
    return remaining / limit < WARNING_THRESHOLD_RATIO;
  }
  return false;
}

export function warningLimits(
  limits: Record<string, WorkspaceLimit> | null | undefined
): WarningLimit[] {
  if (!limits) return [];
  return Object.entries(limits)
    .filter(([, value]) =>
      isWarningLimit(value.limit, value.remaining, value.behavior)
    )
    .map(([resource, value]) => ({
      resource,
      limit: value.limit,
      remaining: value.remaining,
      used: Math.max(0, value.limit - value.remaining),
    }))
    .sort(
      (a, b) =>
        a.remaining - b.remaining || a.resource.localeCompare(b.resource)
    );
}
