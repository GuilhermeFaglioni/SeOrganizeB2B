import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockGetUser, mockToday } = vi.hoisted(() => ({
  mockPrisma: {
    installment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  mockGetUser: vi.fn(),
  mockToday: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mockGetUser,
}));

vi.mock("@/lib/financial/civil-date", () => ({
  todayCivilDate: () => mockToday(),
  isCivilDate: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
}));

function makeInstallment(overrides: {
  id: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
}) {
  return {
    id: overrides.id,
    contractId: "ctr-1",
    expectedAmount: "1000.00",
    dueDate: overrides.dueDate,
    paymentMethod: "pix",
    status: overrides.status,
    paidAt: overrides.paidAt ?? null,
    refundOfId: null,
    cycleKey: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    contract: {
      id: "ctr-1",
      code: "CTR-001",
      title: "Test Contract",
      client: { name: "Acme Corp" },
    },
  };
}

describe("GET /api/receivables overdue derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockToday.mockReturnValue("2026-08-01");
  });

  it("derives displayStatus=overdue when stored status is pending and dueDate is before today", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([
      makeInstallment({ id: "inst-1", status: "pending", dueDate: "2026-07-15" }),
    ]);
    mockPrisma.installment.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/receivables/route");
    const res = await GET(
      new NextRequest("http://localhost/api/receivables?status=overdue")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const item = body.data.items[0];
    expect(item.status).toBe("pending");
    expect(item.displayStatus).toBe("overdue");
  });

  it("keeps displayStatus=pending when stored status is pending and dueDate is today or future", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([
      makeInstallment({ id: "inst-2", status: "pending", dueDate: "2026-08-01" }),
      makeInstallment({ id: "inst-3", status: "pending", dueDate: "2026-08-15" }),
    ]);
    mockPrisma.installment.count.mockResolvedValue(2);

    const { GET } = await import("@/app/api/receivables/route");
    const res = await GET(
      new NextRequest("http://localhost/api/receivables")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const items = body.data.items;
    expect(items[0].status).toBe("pending");
    expect(items[0].displayStatus).toBe("pending");
    expect(items[1].status).toBe("pending");
    expect(items[1].displayStatus).toBe("pending");
  });

  it("keeps displayStatus=paid when stored status is paid even if dueDate is in the past", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([
      makeInstallment({
        id: "inst-4",
        status: "paid",
        dueDate: "2026-06-01",
        paidAt: "2026-06-05",
      }),
    ]);
    mockPrisma.installment.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/receivables/route");
    const res = await GET(
      new NextRequest("http://localhost/api/receivables?status=paid")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const item = body.data.items[0];
    expect(item.status).toBe("paid");
    expect(item.displayStatus).toBe("paid");
  });

  it("keeps displayStatus=cancelled when stored status is cancelled", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([
      makeInstallment({ id: "inst-5", status: "cancelled", dueDate: "2026-05-01" }),
    ]);
    mockPrisma.installment.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/receivables/route");
    const res = await GET(
      new NextRequest("http://localhost/api/receivables?status=cancelled")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const item = body.data.items[0];
    expect(item.status).toBe("cancelled");
    expect(item.displayStatus).toBe("cancelled");
  });

  it("overdue filter queries pending status with dueDate before today", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([]);
    mockPrisma.installment.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/receivables/route");
    await GET(
      new NextRequest("http://localhost/api/receivables?status=overdue")
    );

    const where = mockPrisma.installment.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("pending");
    expect(where.dueDate).toEqual({ lt: "2026-08-01" });
  });

  it("returned items still contain stored status for action eligibility", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([
      makeInstallment({ id: "inst-6", status: "pending", dueDate: "2026-07-10" }),
    ]);
    mockPrisma.installment.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/receivables/route");
    const res = await GET(
      new NextRequest("http://localhost/api/receivables")
    );
    const body = await res.json();

    const item = body.data.items[0];
    expect(item.status).toBe("pending");
    expect(item.displayStatus).toBe("overdue");
  });
});

describe("StatusBadge overdue rendering", () => {
  it("renders overdue with danger styling", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../components/financial/shared/status-badge.tsx"),
      "utf8"
    );
    expect(source).toContain('overdue: "bg-danger-bg text-danger"');
  });

  it("uses displayStatus for badge rendering in receivables list", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const source = readFileSync(
      resolve(__dirname, "../components/financial/receivables/receivables-list.tsx"),
      "utf8"
    );
    expect(source).toContain("installment.displayStatus");
    expect(source).toContain("DisplayableInstallment");
  });
});
