import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { isGracePeriodExpired } from "../lib/workspace/grace-period";
import { getWorkspaceAccessMode } from "../lib/workspace/access";
import type { WorkspaceData } from "../hooks/use-workspace";

const bannerSource = readFileSync(
  new URL("../components/billing/grace-period-banner.tsx", import.meta.url),
  "utf8"
);

const accessSource = readFileSync(
  new URL("../lib/workspace/access.ts", import.meta.url),
  "utf8"
);

const authGateSource = readFileSync(
  new URL("../components/auth/auth-gate.tsx", import.meta.url),
  "utf8"
);

const DAY_MS = 24 * 60 * 60 * 1000;

function workspace(
  status: WorkspaceData["status"],
  endsAtDaysFromNow: number | null
): WorkspaceData {
  return {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: "Acme Inc",
    onboardingCompleted: false,
    status,
    gracePeriodEndsAt:
      endsAtDaysFromNow === null
        ? null
        : new Date(Date.now() + endsAtDaysFromNow * DAY_MS).toISOString(),
    plan: null,
    features: {
      allowedModules: [],
      limits: {},
      usage: { users: 0, tasks: 0, projects: 0, contracts: 0 },
    },
  };
}

describe("isGracePeriodExpired", () => {
  it("is false for non-grace workspaces and missing data", () => {
    expect(isGracePeriodExpired(workspace("active", null))).toBe(false);
    expect(isGracePeriodExpired(workspace("cancelled", -1))).toBe(false);
    expect(isGracePeriodExpired(null)).toBe(false);
    expect(isGracePeriodExpired(undefined)).toBe(false);
  });

  it("is true when the grace period end date is in the past", () => {
    expect(isGracePeriodExpired(workspace("grace_period", -1))).toBe(true);
    expect(isGracePeriodExpired(workspace("grace_period", -0.001))).toBe(true);
  });

  it("is false while the grace period is still active", () => {
    expect(isGracePeriodExpired(workspace("grace_period", 1))).toBe(false);
    expect(isGracePeriodExpired(workspace("grace_period", 5))).toBe(false);
  });

  it("is false when the grace period has no end date", () => {
    expect(isGracePeriodExpired(workspace("grace_period", null))).toBe(false);
  });
});

describe("grace period access mode", () => {
  it("treats an expired grace period as expired (cancelled)", () => {
    expect(getWorkspaceAccessMode(workspace("grace_period", -1))).toBe("expired");
    expect(getWorkspaceAccessMode(workspace("grace_period", -0.001))).toBe("expired");
  });

  it("keeps an active grace period in grace mode with the banner", () => {
    expect(getWorkspaceAccessMode(workspace("grace_period", 1))).toBe("grace");
    expect(getWorkspaceAccessMode(workspace("grace_period", 5))).toBe("grace");
  });

  it("wires the grace period expiry check into access mode", () => {
    expect(accessSource).toContain("isGracePeriodExpired");
    expect(accessSource).toContain('workspace.status === "grace_period"');
  });

  it("redirects expired workspaces (including expired grace) to the expiration page", () => {
    expect(authGateSource).toContain("mode === \"expired\"");
    expect(authGateSource).toContain("router.replace(\"/expired\")");
  });
});

describe("GracePeriodBanner UI", () => {
  it("renders the grace period end date", () => {
    expect(bannerSource).toContain("toLocaleDateString()");
    expect(bannerSource).toContain('t("message", { date })');
    expect(bannerSource).toContain("data-testid=\"grace-period-banner\"");
  });

  it("shows the warning (amber/orange) styling", () => {
    expect(bannerSource).toContain("bg-warning-bg");
    expect(bannerSource).toContain("text-warning");
  });

  it("triggers the Stripe portal and redirects on the update payment button", () => {
    expect(bannerSource).toContain('"/api/stripe/portal"');
    expect(bannerSource).toContain('method: "POST"');
    expect(bannerSource).toContain("window.location.href = url");
    expect(bannerSource).toContain('t("updatePayment")');
  });

  it("is rendered at the top of the layout for grace workspaces", () => {
    expect(authGateSource).toContain('mode === "grace" && <GracePeriodBanner />');
  });
});
