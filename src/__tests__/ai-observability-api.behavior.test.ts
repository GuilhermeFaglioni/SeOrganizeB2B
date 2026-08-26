import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSuperAdminStatus: vi.fn(), report: vi.fn(), csv: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/admin/super-admin", () => ({ getSuperAdminStatus: mocks.getSuperAdminStatus }));
vi.mock("@/lib/ai/admin-observability", () => ({ getAIObservabilityReport: mocks.report, aiObservabilityCsv: mocks.csv }));

import { GET } from "../app/api/admin/ai-observability/route";

describe("admin AI observability API", () => {
  it("requires super-admin access and forwards safe filters", async () => {
    mocks.getUser.mockResolvedValue({ id: "admin-1" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);
    mocks.report.mockResolvedValue({ summary: {}, ledger: [], cycles: [], highUsageTenants: [], highUsageMembers: [], filters: {} });
    const response = await GET(new NextRequest("http://localhost/api/admin/ai-observability?provider=zen&model=model-1&planId=plan-1&tenantId=tenant-1"));
    expect(response.status).toBe(200);
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ provider: "zen", model: "model-1", planId: "plan-1", tenantId: "tenant-1" }));
  });

  it("returns a CSV attachment without changing the report contract", async () => {
    mocks.getUser.mockResolvedValue({ id: "admin-1" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);
    mocks.report.mockResolvedValue({});
    mocks.csv.mockReturnValue("record\n");
    const response = await GET(new NextRequest("http://localhost/api/admin/ai-observability?format=csv"));
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toBe("record\n");
  });
});
