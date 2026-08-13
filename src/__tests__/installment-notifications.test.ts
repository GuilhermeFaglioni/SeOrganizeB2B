import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { toDecimal } from "../lib/financial/money";

const { mockPrisma, mockRecordActivity, mockSendPushToUsers, mockBuildPushPayload } = vi.hoisted(() => {
  const mockPrisma = {
    installment: { findMany: vi.fn() },
    activity: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      activity: { create: vi.fn() },
      notification: { createMany: vi.fn() },
    })),
  };
  return {
    mockPrisma,
    mockRecordActivity: vi.fn(),
    mockSendPushToUsers: vi.fn(),
    mockBuildPushPayload: vi.fn(),
  };
});

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
  requireTenantId: () => "tenant-1",
}));

vi.mock("../lib/activity/record", () => ({
  recordActivity: mockRecordActivity,
}));

vi.mock("../lib/push", () => ({
  sendPushToUsers: mockSendPushToUsers,
}));

vi.mock("../lib/push/payload", () => ({
  buildPushPayload: mockBuildPushPayload,
}));

import { checkAndNotifyInstallments } from "../lib/financial/installment-notifications";

describe("checkAndNotifyInstallments", () => {
  beforeEach(() => {
    mockPrisma.installment.findMany.mockReset();
    mockPrisma.activity.findFirst.mockReset();
    mockPrisma.$transaction.mockReset();
    mockRecordActivity.mockReset();
    mockSendPushToUsers.mockReset();
    mockBuildPushPayload.mockReset();
    // Default: no existing activity (idempotency check passes)
    mockPrisma.activity.findFirst.mockResolvedValue(null);
    // Re-setup $transaction default
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      activity: { create: vi.fn() },
      notification: { createMany: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counts when no installments found", async () => {
    mockPrisma.installment.findMany.mockResolvedValue([]);

    const result = await checkAndNotifyInstallments();

    expect(result).toEqual({ dueTomorrow: 0, overdue: 0 });
  });

  it("creates notifications for installments due tomorrow", async () => {
    const dueTomorrowInstallment = {
      id: "inst-1",
      expectedAmount: toDecimal("1000.00"),
      dueDate: "2026-08-14", // tomorrow
      status: "pending",
      contract: {
        id: "ctr-1",
        code: "CTR-2026-0001",
        title: "Consultoria",
        ownerId: "user-1",
        tenantId: "tenant-1",
        client: { name: "Acme Corp" },
      },
    };

    // First call returns due tomorrow, second call returns empty for overdue
    mockPrisma.installment.findMany
      .mockResolvedValueOnce([dueTomorrowInstallment])
      .mockResolvedValueOnce([]);
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-1"] });
    mockBuildPushPayload.mockReturnValue({ title: "Parcela vence amanhã", body: "..." });

    const result = await checkAndNotifyInstallments();

    expect(result.dueTomorrow).toBe(1);
    expect(result.overdue).toBe(0);
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "installment.due_tomorrow",
        entityType: "installment",
        entityId: "inst-1",
        notifyProfileIds: ["user-1"],
      })
    );
  });

  it("creates notifications for overdue installments", async () => {
    const overdueInstallment = {
      id: "inst-2",
      expectedAmount: toDecimal("500.00"),
      dueDate: "2026-08-10", // past
      status: "pending",
      contract: {
        id: "ctr-2",
        code: "CTR-2026-0002",
        title: "Desenvolvimento",
        ownerId: "user-2",
        tenantId: "tenant-1",
        client: { name: "Beta Inc" },
      },
    };

    mockPrisma.installment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([overdueInstallment]);
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-2"] });
    mockBuildPushPayload.mockReturnValue({ title: "Parcela vencida", body: "..." });

    const result = await checkAndNotifyInstallments();

    expect(result.dueTomorrow).toBe(0);
    expect(result.overdue).toBe(1);
    expect(mockRecordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "installment.overdue",
        entityType: "installment",
        entityId: "inst-2",
        notifyProfileIds: ["user-2"],
      })
    );
  });

  it("skips installments without contract owner", async () => {
    const installmentNoOwner = {
      id: "inst-3",
      expectedAmount: toDecimal("100.00"),
      dueDate: "2026-08-14",
      status: "pending",
      contract: {
        id: "ctr-3",
        code: "CTR-2026-0003",
        title: "Test",
        ownerId: null,
        tenantId: "tenant-1",
        client: { name: "Gamma" },
      },
    };

    mockPrisma.installment.findMany
      .mockResolvedValueOnce([installmentNoOwner])
      .mockResolvedValueOnce([]);

    const result = await checkAndNotifyInstallments();

    expect(result.dueTomorrow).toBe(0);
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("handles duplicate notifications gracefully (unique constraint)", async () => {
    const installment = {
      id: "inst-4",
      expectedAmount: toDecimal("200.00"),
      dueDate: "2026-08-14",
      status: "pending",
      contract: {
        id: "ctr-4",
        code: "CTR-2026-0004",
        title: "Test",
        ownerId: "user-4",
        tenantId: "tenant-1",
        client: { name: "Delta" },
      },
    };

    mockPrisma.installment.findMany
      .mockResolvedValueOnce([installment])
      .mockResolvedValueOnce([]);
    // Simulate unique constraint violation
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("Unique constraint"));

    const result = await checkAndNotifyInstallments();

    // Should not throw, just skip
    expect(result.dueTomorrow).toBe(0);
  });

  it("skips installments that already have an Activity (idempotency)", async () => {
    const installment = {
      id: "inst-5",
      expectedAmount: toDecimal("300.00"),
      dueDate: "2026-08-14",
      status: "pending",
      contract: {
        id: "ctr-5",
        code: "CTR-2026-0005",
        title: "Test",
        ownerId: "user-5",
        tenantId: "tenant-1",
        client: { name: "Epsilon" },
      },
    };

    mockPrisma.installment.findMany
      .mockResolvedValueOnce([installment])
      .mockResolvedValueOnce([]);

    // Simulate existing activity found — dedup
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "existing-activity" });

    const result = await checkAndNotifyInstallments();

    expect(result.dueTomorrow).toBe(0);
    expect(mockRecordActivity).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("second call does not duplicate notifications for the same installment", async () => {
    const installment = {
      id: "inst-6",
      expectedAmount: toDecimal("400.00"),
      dueDate: "2026-08-14",
      status: "pending",
      contract: {
        id: "ctr-6",
        code: "CTR-2026-0006",
        title: "Test",
        ownerId: "user-6",
        tenantId: "tenant-1",
        client: { name: "Zeta" },
      },
    };

    // First call: no existing activity → creates notification
    mockPrisma.installment.findMany
      .mockResolvedValueOnce([installment])
      .mockResolvedValueOnce([]);
    mockRecordActivity.mockResolvedValue({ notifiedProfileIds: ["user-6"] });
    mockBuildPushPayload.mockReturnValue({ title: "Parcela vence amanhã", body: "..." });

    const result1 = await checkAndNotifyInstallments();
    expect(result1.dueTomorrow).toBe(1);
    expect(mockRecordActivity).toHaveBeenCalledTimes(1);

    // Reset mocks for second call
    mockPrisma.installment.findMany.mockReset();
    mockPrisma.activity.findFirst.mockReset();
    mockRecordActivity.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      activity: { create: vi.fn() },
      notification: { createMany: vi.fn() },
    }));

    // Second call: same installment returned, but activity now exists
    mockPrisma.installment.findMany
      .mockResolvedValueOnce([installment])
      .mockResolvedValueOnce([]);
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "existing-activity" });

    const result2 = await checkAndNotifyInstallments();
    expect(result2.dueTomorrow).toBe(0);
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
