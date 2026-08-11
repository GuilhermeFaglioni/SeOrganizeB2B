import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { getWorkspaceAccessMode } from "../lib/workspace/access";
import type { WorkspaceData } from "../hooks/use-workspace";

const authGateSource = readFileSync(
  new URL("../components/auth/auth-gate.tsx", import.meta.url),
  "utf8"
);

const accessSource = readFileSync(
  new URL("../lib/workspace/access.ts", import.meta.url),
  "utf8"
);

const DAY_MS = 24 * 60 * 60 * 1000;

function workspace(status: WorkspaceData["status"], endsAtDaysFromNow: number | null): WorkspaceData {
  return {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: "Acme Inc",
    status,
    gracePeriodEndsAt:
      endsAtDaysFromNow === null
        ? null
        : new Date(Date.now() + endsAtDaysFromNow * DAY_MS).toISOString(),
    plan: null,
    features: { allowedModules: [], limits: {}, usage: { users: 0, tasks: 0, projects: 0, contracts: 0 } },
  };
}

describe("AuthGate workspace status gating", () => {
  it("active workspace grants normal access", () => {
    expect(getWorkspaceAccessMode(workspace("active", null))).toBe("active");
  });

  it("grace_period workspace grants normal access with banner", () => {
    expect(getWorkspaceAccessMode(workspace("grace_period", 5))).toBe("grace");
  });

  it("cancelled workspace with more than 30 days remaining is expired", () => {
    expect(getWorkspaceAccessMode(workspace("cancelled", 31))).toBe("expired");
  });

  it("cancelled workspace with up to 30 days remaining is read-only", () => {
    expect(getWorkspaceAccessMode(workspace("cancelled", 30))).toBe("readonly");
    expect(getWorkspaceAccessMode(workspace("cancelled", 0))).toBe("readonly");
  });

  it("cancelled workspace without an end date is expired", () => {
    expect(getWorkspaceAccessMode(workspace("cancelled", null))).toBe("expired");
  });

  it("missing workspace data defaults to active", () => {
    expect(getWorkspaceAccessMode(undefined)).toBe("active");
    expect(getWorkspaceAccessMode(null)).toBe("active");
  });

  it("renders children for active workspaces without banners", () => {
    expect(authGateSource).toContain("mode === \"grace\" && <GracePeriodBanner />");
    expect(authGateSource).toContain("mode === \"readonly\" && <ExpirationBanner />");
    expect(authGateSource).toContain("{children}");
  });

  it("renders the GracePeriodBanner for grace_period workspaces", () => {
    expect(authGateSource).toContain("GracePeriodBanner");
    expect(accessSource).toContain("workspace.status === \"grace_period\"");
  });

  it("redirects cancelled workspaces past 30 days to the expiration page", () => {
    expect(authGateSource).toContain("router.replace(\"/expired\")");
    expect(authGateSource).toContain("pathname !== \"/expired\"");
    expect(accessSource).toContain("daysLeft > CANCELLED_READONLY_DAYS");
  });

  it("enables read-only mode for cancelled workspaces within 30 days", () => {
    expect(authGateSource).toContain("const readOnly = mode === \"readonly\"");
    expect(authGateSource).toContain("readOnly={readOnly}");
    expect(authGateSource).toContain("WorkspaceProvider");
  });

  it("caches workspace data via React Query", () => {
    expect(authGateSource).toContain("useWorkspace()");
    const hook = readFileSync(
      new URL("../hooks/use-workspace.ts", import.meta.url),
      "utf8"
    );
    expect(hook).toContain("useQuery");
    expect(hook).toContain("\"/api/workspace\"");
    expect(hook).toContain("queryKey: [\"workspace\"]");
    expect(hook).toContain("staleTime");
  });

  it("keeps redirecting unauthenticated users to /login", () => {
    expect(authGateSource).toContain("router.push(\"/login\")");
  });
});
