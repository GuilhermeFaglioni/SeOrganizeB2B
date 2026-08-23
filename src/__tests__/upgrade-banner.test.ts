import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { isWarningLimit, warningLimits } from "../lib/workspace/limits";
import type { WorkspaceLimit } from "../hooks/use-workspace";

const bannerSource = readFileSync(
  new URL("../components/billing/upgrade-banner.tsx", import.meta.url),
  "utf8"
);

const limitsSource = readFileSync(
  new URL("../lib/workspace/limits.ts", import.meta.url),
  "utf8"
);

const authGateSource = readFileSync(
  new URL("../components/auth/auth-gate.tsx", import.meta.url),
  "utf8"
);

function limit(
  resource: string,
  limit: number,
  remaining: number,
  behavior: string
): Record<string, WorkspaceLimit> {
  return { [resource]: { limit, remaining, behavior } };
}

describe("isWarningLimit", () => {
  it("flags warning limits that are exhausted or below the threshold", () => {
    expect(isWarningLimit(100, 0, "warning")).toBe(true);
    expect(isWarningLimit(100, 5, "warning")).toBe(true);
    expect(isWarningLimit(100, 19, "warning")).toBe(true);
  });

  it("does not flag warning limits at or above the threshold", () => {
    expect(isWarningLimit(100, 20, "warning")).toBe(false);
    expect(isWarningLimit(100, 90, "warning")).toBe(false);
  });

  it("never flags hard limits, even when exhausted", () => {
    expect(isWarningLimit(5, 0, "hard")).toBe(false);
  });

  it("does not warn for non-finite limits with remaining above zero", () => {
    expect(isWarningLimit(Number.POSITIVE_INFINITY, 5, "warning")).toBe(false);
  });
});

describe("warningLimits", () => {
  it("returns only resources at or below the warning threshold", () => {
    const result = warningLimits({
      ...limit("tasks", 100, 5, "warning"),
      ...limit("projects", 10, 4, "hard"),
      ...limit("users", 5, 3, "hard"),
    });
    expect(result).toHaveLength(1);
    expect(result[0].resource).toBe("tasks");
  });

  it("returns nothing when no warning limit is reached", () => {
    expect(warningLimits(limit("tasks", 100, 90, "warning"))).toHaveLength(0);
  });

  it("returns nothing for hard limits even when exhausted", () => {
    expect(warningLimits(limit("users", 5, 0, "hard"))).toHaveLength(0);
  });

  it("handles missing or empty limit data", () => {
    expect(warningLimits(undefined)).toEqual([]);
    expect(warningLimits(null)).toEqual([]);
    expect(warningLimits({})).toEqual([]);
  });

  it("computes usage from limit minus remaining and sorts by severity", () => {
    const result = warningLimits({
      ...limit("projects", 10, 1, "warning"),
      ...limit("tasks", 100, 2, "warning"),
    });
    expect(result[0].resource).toBe("projects");
    expect(result[0].used).toBe(9);
  });
});

describe("UpgradeBanner UI", () => {
  it("detects warning limits via the shared helper", () => {
    expect(bannerSource).toContain("warningLimits");
    expect(bannerSource).toContain("workspace?.features.limits");
  });

  it("renders the resource, current limit and current usage", () => {
    expect(bannerSource).toContain('t("message", { resource: resourceLabel })');
    expect(bannerSource).toContain('t("usage", { used, limit })');
  });

  it("shows the info (blue) styling", () => {
    expect(bannerSource).toContain("bg-info-bg");
    expect(bannerSource).toContain("text-info");
  });

  it("navigates to the plans page to upgrade", () => {
    expect(bannerSource).toContain('pushWithAIStudioGuard(router, "/plans")');
    expect(bannerSource).toContain("useRouter");
  });

  it("does not render when there are no warning limits", () => {
    expect(bannerSource).toContain("warnings.length === 0");
    expect(bannerSource).toContain("return null");
  });

  it("excludes hard limits from the banner", () => {
    expect(limitsSource).toContain('behavior !== "warning"');
  });

  it("is rendered below the grace period banner in the authenticated layout", () => {
    expect(authGateSource).toContain("<UpgradeBanner />");
    const graceIndex = authGateSource.indexOf("<GracePeriodBanner />");
    const upgradeIndex = authGateSource.indexOf("<UpgradeBanner />");
    expect(graceIndex).toBeGreaterThan(-1);
    expect(upgradeIndex).toBeGreaterThan(graceIndex);
  });
});
