import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockComputeOverview } = vi.hoisted(() => ({
  mockComputeOverview: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {},
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/financial/overview-service", () => ({
  get computeOverview() {
    return mockComputeOverview;
  },
}));

import { GET as overviewGET } from "../app/api/financial/overview/route";

const makeRequest = (url: string) => new NextRequest(url);

const mockOverviewData = {
  kpis: {
    activeContractedValue: "5000.00",
    mrr: "416.67",
    arr: "5000.00",
    cashForecast: "1000.00",
    received: "500.00",
    overdue: "200.00",
    upsell: "300.00",
    downsell: "0.00",
    activeContracts: 2,
    expiringSoon: 1,
  },
  monthly: [
    { month: "2026-08", forecast: "1000.00", received: "500.00" },
    { month: "2026-09", forecast: "1000.00", received: "0.00" },
  ],
  overdueInstallments: [
    {
      id: "inst-1",
      contractCode: "CTR-2026-0001",
      contractTitle: "Test Contract",
      clientName: "Acme",
      expectedAmount: "200.00",
      dueDate: "2026-07-15",
    },
  ],
  expiringContracts: [
    {
      id: "ctr-1",
      code: "CTR-2026-0001",
      title: "Test Contract",
      clientName: "Acme",
      status: "active",
      endDate: "2026-08-30",
      officialValue: "5000.00",
    },
  ],
};

describe("overview API route behavior", () => {
  beforeEach(() => {
    mockComputeOverview.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("AUTH_ERROR");
    expect(mockComputeOverview).not.toHaveBeenCalled();
  });

  it("returns overview data with default period currentMonth", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.kpis.activeContractedValue).toBe("5000.00");
    expect(json.error).toBeNull();
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ period: "currentMonth" })
    );
  });

  it("passes period=next90 when specified", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(
      makeRequest("http://x/api/financial/overview?period=next90")
    );
    expect(res.status).toBe(200);
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ period: "next90" })
    );
  });

  it("passes period=custom with from/to dates", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(
      makeRequest(
        "http://x/api/financial/overview?period=custom&from=2026-08-01&to=2026-12-31"
      )
    );
    expect(res.status).toBe(200);
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "custom",
        from: "2026-08-01",
        to: "2026-12-31",
      })
    );
  });

  it("falls back to currentMonth for invalid period", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(
      makeRequest("http://x/api/financial/overview?period=invalid")
    );
    expect(res.status).toBe(200);
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ period: "currentMonth" })
    );
  });

  it("passes clientId filter", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    await overviewGET(
      makeRequest("http://x/api/financial/overview?clientId=c-1")
    );
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "c-1" })
    );
  });

  it("passes contractStatus filter", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    await overviewGET(
      makeRequest("http://x/api/financial/overview?contractStatus=active")
    );
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ contractStatus: "active" })
    );
  });

  it("passes projectId filter", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    await overviewGET(
      makeRequest("http://x/api/financial/overview?projectId=p-1")
    );
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p-1" })
    );
  });

  it("passes installmentStatus filter", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    await overviewGET(
      makeRequest("http://x/api/financial/overview?installmentStatus=pending")
    );
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({ installmentStatus: "pending" })
    );
  });

  it("returns all KPI fields in the response", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    const json = await res.json();
    const kpis = json.data.kpis;
    expect(kpis).toHaveProperty("activeContractedValue");
    expect(kpis).toHaveProperty("mrr");
    expect(kpis).toHaveProperty("arr");
    expect(kpis).toHaveProperty("cashForecast");
    expect(kpis).toHaveProperty("received");
    expect(kpis).toHaveProperty("overdue");
    expect(kpis).toHaveProperty("upsell");
    expect(kpis).toHaveProperty("downsell");
    expect(kpis).toHaveProperty("activeContracts");
    expect(kpis).toHaveProperty("expiringSoon");
  });

  it("returns monthly series in the response", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    const json = await res.json();
    expect(json.data.monthly).toHaveLength(2);
    expect(json.data.monthly[0]).toHaveProperty("month");
    expect(json.data.monthly[0]).toHaveProperty("forecast");
    expect(json.data.monthly[0]).toHaveProperty("received");
  });

  it("returns overdueInstallments in the response", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    const json = await res.json();
    expect(json.data.overdueInstallments).toHaveLength(1);
    expect(json.data.overdueInstallments[0]).toHaveProperty("id");
    expect(json.data.overdueInstallments[0]).toHaveProperty("contractCode");
    expect(json.data.overdueInstallments[0]).toHaveProperty("contractTitle");
    expect(json.data.overdueInstallments[0]).toHaveProperty("clientName");
    expect(json.data.overdueInstallments[0]).toHaveProperty("expectedAmount");
    expect(json.data.overdueInstallments[0]).toHaveProperty("dueDate");
  });

  it("returns expiringContracts in the response", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    const json = await res.json();
    expect(json.data.expiringContracts).toHaveLength(1);
    expect(json.data.expiringContracts[0]).toHaveProperty("id");
    expect(json.data.expiringContracts[0]).toHaveProperty("code");
    expect(json.data.expiringContracts[0]).toHaveProperty("title");
    expect(json.data.expiringContracts[0]).toHaveProperty("clientName");
    expect(json.data.expiringContracts[0]).toHaveProperty("status");
    expect(json.data.expiringContracts[0]).toHaveProperty("endDate");
    expect(json.data.expiringContracts[0]).toHaveProperty("officialValue");
  });

  it("returns 500 when computeOverview throws", async () => {
    mockComputeOverview.mockRejectedValue(new Error("db connection failed"));

    const res = await overviewGET(makeRequest("http://x/api/financial/overview"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("db connection failed");
    expect(json.data).toBeNull();
  });

  it("returns undefined filters as undefined to computeOverview", async () => {
    mockComputeOverview.mockResolvedValue(mockOverviewData);

    await overviewGET(makeRequest("http://x/api/financial/overview"));
    expect(mockComputeOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: undefined,
        to: undefined,
        clientId: undefined,
        contractStatus: undefined,
        projectId: undefined,
        installmentStatus: undefined,
      })
    );
  });
});
