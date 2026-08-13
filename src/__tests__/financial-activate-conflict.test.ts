import { describe, expect, it, vi } from "vitest";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    contract: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contractProject: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    installment: {
      createMany: vi.fn(),
    },
    contractAudit: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    $transaction: vi.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
  getTenantId: () => "tenant-1",
}));

import { activateContract, confirmContract } from "../lib/financial/contracts-service";
import { FinancialConflictError } from "../lib/financial/lifecycle";
import { toDecimal } from "../lib/financial/money";

const tx = mockTx;

function resetTx() {
  tx.contract.findUnique.mockReset();
  tx.contract.update.mockReset();
  tx.contractProject.findFirst.mockReset();
  tx.contractProject.deleteMany.mockReset();
  tx.installment.createMany.mockReset();
  tx.contractAudit.create.mockReset();
}

const plan = [
  { expectedAmount: "100.00", dueDate: "2026-09-01", paymentMethod: "pix" as const },
];

describe("activateContract conflict logic", () => {
  it("confirms fields and activation in one transaction, rolling back on invalid plan", async () => {
    resetTx();
    const contractId = "confirm-1";
    tx.contract.findUnique
      .mockResolvedValueOnce({ status: "draft" })
      .mockResolvedValueOnce({
        id: contractId,
        clientId: "client-1",
        title: "Confirmed",
        durationType: "fixed",
        officialValue: toDecimal("100.00"),
        startDate: "2026-09-01",
        endDate: "2026-10-01",
        billingFrequency: "monthly",
        status: "draft",
        predecessorId: null,
        projects: [],
      });

    await expect(confirmContract(contractId, {
      durationType: "fixed",
      billingFrequency: "monthly",
      startDate: "2026-09-01",
      endDate: "2026-10-01",
      paymentMethod: "pix",
      plan: [{ expectedAmount: "99.99", dueDate: "2026-09-01", paymentMethod: "pix" }],
    }, "actor-1")).rejects.toThrow("Installment total must equal");

    expect(tx.contract.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: contractId },
      data: expect.objectContaining({ durationType: "fixed", startDate: "2026-09-01" }),
    }));
    expect(tx.installment.createMany).not.toHaveBeenCalled();
  });

  it("allows overlap with the active predecessor (renewal transfer)", async () => {
    resetTx();

    const predecessorId = "pred-1";
    const contractId = "new-1";
    const projectId = "proj-1";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "Renewal",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "draft",
          predecessorId,
          projects: [{ projectId }],
        };
      }
      if (args.where.id === predecessorId) {
        return { status: "active" };
      }
      return null;
    });

    tx.contractProject.findFirst.mockResolvedValue(null);
    tx.installment.createMany.mockResolvedValue({ count: 1 });
    tx.contract.update.mockResolvedValue({ id: contractId, status: "active" });
    tx.contractAudit.create.mockResolvedValue({});
    tx.contractProject.deleteMany.mockResolvedValue({ count: 1 });

    const result = await activateContract(contractId, plan, "actor-1");

    expect(result.status).toBe("active");

    expect(tx.contractProject.findFirst).toHaveBeenCalled();

    const firstCallWhere = tx.contractProject.findFirst.mock.calls[0][0].where;
    expect(firstCallWhere.projectId).toBe(projectId);
    expect(firstCallWhere.contract.status).toBe("active");
    expect(firstCallWhere.contract.id.notIn).toContain(predecessorId);

    expect(tx.contractProject.deleteMany).toHaveBeenCalledWith({
      where: { contractId: predecessorId },
    });
    expect(tx.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: predecessorId },
        data: { status: "closed" },
      })
    );

    const findFirstOrder = tx.contractProject.findFirst.mock.invocationCallOrder[0];
    const deleteManyOrder = tx.contractProject.deleteMany.mock.invocationCallOrder[0];
    expect(findFirstOrder).toBeLessThan(deleteManyOrder);
  });

  it("rejects overlap with a third active contract", async () => {
    resetTx();

    const predecessorId = "pred-2";
    const contractId = "new-2";
    const projectId = "proj-2";
    const thirdPartyId = "third-party";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "Renewal",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "draft",
          predecessorId,
          projects: [{ projectId }],
        };
      }
      if (args.where.id === predecessorId) {
        return { status: "active" };
      }
      return null;
    });

    tx.contractProject.findFirst.mockResolvedValue({ contractId: thirdPartyId });

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow(FinancialConflictError);

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow("already belongs to another active contract");

    expect(tx.installment.createMany).not.toHaveBeenCalled();
    expect(tx.contractProject.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects overlap when contract has no predecessor and another active contract holds the project", async () => {
    resetTx();

    const contractId = "new-3";
    const projectId = "proj-3";
    const thirdPartyId = "third-party-2";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "New Contract",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "draft",
          predecessorId: null,
          projects: [{ projectId }],
        };
      }
      return null;
    });

    tx.contractProject.findFirst.mockResolvedValue({ contractId: thirdPartyId });

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow(FinancialConflictError);

    expect(tx.installment.createMany).not.toHaveBeenCalled();
  });

  it("allows activation when no conflicting active contracts exist", async () => {
    resetTx();

    const contractId = "new-4";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "Fresh Contract",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "draft",
          predecessorId: null,
          projects: [{ projectId: "proj-4" }],
        };
      }
      return null;
    });

    tx.contractProject.findFirst.mockResolvedValue(null);
    tx.installment.createMany.mockResolvedValue({ count: 1 });
    tx.contract.update.mockResolvedValue({ id: contractId, status: "active" });
    tx.contractAudit.create.mockResolvedValue({});

    const result = await activateContract(contractId, plan, "actor-1");

    expect(result.status).toBe("active");
    expect(tx.installment.createMany).toHaveBeenCalledTimes(1);
    expect(tx.contractProject.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects activation of a cancelled contract", async () => {
    resetTx();

    const contractId = "cancelled-1";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "Cancelled Contract",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "cancelled",
          predecessorId: null,
          projects: [],
        };
      }
      return null;
    });

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow(FinancialConflictError);

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow("Only draft contracts can be activated");

    expect(tx.installment.createMany).not.toHaveBeenCalled();
    expect(tx.contract.update).not.toHaveBeenCalled();
    expect(tx.contractProject.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects activation of an active contract", async () => {
    resetTx();

    const contractId = "active-1";

    tx.contract.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === contractId) {
        return {
          id: contractId,
          clientId: "client-1",
          title: "Already Active",
          durationType: "fixed",
          officialValue: toDecimal("100.00"),
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          status: "active",
          predecessorId: null,
          projects: [],
        };
      }
      return null;
    });

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow(FinancialConflictError);

    await expect(
      activateContract(contractId, plan, "actor-1")
    ).rejects.toThrow("Only draft contracts can be activated");

    expect(tx.installment.createMany).not.toHaveBeenCalled();
    expect(tx.contract.update).not.toHaveBeenCalled();
    expect(tx.contractProject.deleteMany).not.toHaveBeenCalled();
  });
});
