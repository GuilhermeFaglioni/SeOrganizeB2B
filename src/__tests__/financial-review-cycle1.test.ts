import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { activationErrors } from "../lib/financial/lifecycle";
import { toDecimal } from "../lib/financial/money";

describe("B1: itemSum safe empty fallbacks", () => {
  it("itemSum handles empty price gracefully (falls back to 0)", () => {
    const form = readForm();
    expect(form).toContain('item.price && item.price !== "" ? item.price : "0"');
    expect(form).toContain('item.quantity && item.quantity !== "" ? item.quantity : "1"');
  });
});

describe("B2: officialValue required-value error and safe parsing", () => {
  it("form shows required-value error when officialValue is empty", () => {
    const form = readForm();
    expect(form).toContain('t("errorOfficialValueRequired")');
    expect(form).toContain("parsedOfficialValue");
  });

  it("form guards toDecimal(officialValue) behind parsedOfficialValue", () => {
    const form = readForm();
    expect(form).toContain("officialValue && officialValue !== \"\" ? toDecimal(officialValue) : null");
  });
});

describe("B3: open-ended activation does NOT require exact sum", () => {
  it("activationErrors does not require sum=officialValue for openEnded", () => {
    const contract = {
      clientId: "c1",
      title: "Open Contract",
      durationType: "openEnded",
      officialValue: toDecimal("100.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: "monthly",
    };
    const plan = [
      { expectedAmount: "100.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
      { expectedAmount: "100.00", dueDate: "2026-02-01", paymentMethod: "pix" as const },
      { expectedAmount: "100.00", dueDate: "2026-03-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors(contract, plan);
    expect(errors).not.toContain("Installment total must equal the official contract value");
  });

  it("activationErrors rejects openEnded with zero officialValue", () => {
    const contract = {
      clientId: "c1",
      title: "Zero Value",
      durationType: "openEnded",
      officialValue: toDecimal("0.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: "monthly",
    };
    const errors = activationErrors(contract, []);
    expect(errors).toContain("A recurring contract value is required");
  });

  it("activationErrors rejects openEnded with missing frequency", () => {
    const contract = {
      clientId: "c1",
      title: "No Freq",
      durationType: "openEnded",
      officialValue: toDecimal("100.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: null,
    };
    const errors = activationErrors(contract, []);
    expect(errors).toContain("A billing frequency is required for recurring contracts");
  });

  it("activationErrors rejects openEnded with empty plan", () => {
    const contract = {
      clientId: "c1",
      title: "Empty Plan",
      durationType: "openEnded",
      officialValue: toDecimal("100.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: "monthly",
    };
    const errors = activationErrors(contract, []);
    expect(errors).toContain("An installment plan is required to activate");
  });

  it("activationErrors rejects openEnded with zero-amount cycle", () => {
    const contract = {
      clientId: "c1",
      title: "Zero Cycle",
      durationType: "openEnded",
      officialValue: toDecimal("100.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: "monthly",
    };
    const plan = [
      { expectedAmount: "0.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors(contract, plan);
    expect(errors).toContain("Each recurring cycle must have a positive amount");
  });

  it("fixed contracts still require exact sum", () => {
    const contract = {
      clientId: "c1",
      title: "Fixed",
      durationType: "fixed",
      officialValue: toDecimal("200.00"),
      startDate: "2026-01-01",
      endDate: "2026-12-01",
      billingFrequency: "monthly",
    };
    const plan = [
      { expectedAmount: "100.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors(contract, plan);
    expect(errors).toContain("Installment total must equal the official contract value");
  });

  it("oneTime contracts still require exact sum", () => {
    const contract = {
      clientId: "c1",
      title: "One Time",
      durationType: "oneTime",
      officialValue: toDecimal("500.00"),
      startDate: "2026-01-01",
      endDate: null,
      billingFrequency: null,
    };
    const plan = [
      { expectedAmount: "300.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors(contract, plan);
    expect(errors).toContain("Installment total must equal the official contract value");
  });

  it("form planErrors for openEnded validates required value and frequency", () => {
    const form = readForm();
    expect(form).toContain('t("errorFrequencyRequired")');
    expect(form).toContain('t("errorPositiveAmount")');
  });

  it("form planErrors for fixed/oneTime still uses validateFinitePlan", () => {
    const form = readForm();
    expect(form).toContain("validateFinitePlan");
  });
});

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    contract: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contractItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    contractProject: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
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
}));

const tx = mockTx;

function resetTx() {
  tx.contract.findUnique.mockReset();
  tx.contract.update.mockReset();
  tx.contractItem.deleteMany.mockReset();
  tx.contractItem.createMany.mockReset();
  tx.contractProject.deleteMany.mockReset();
  tx.contractProject.createMany.mockReset();
  tx.contractProject.findFirst.mockReset();
  tx.contractAudit.create.mockReset();
}

const existingContract = {
  id: "ctr-1",
  clientId: "client-1",
  title: "Original",
  durationType: "fixed",
  officialValue: toDecimal("1000.00"),
  startDate: "2026-01-01",
  endDate: "2026-12-01",
  billingFrequency: "monthly",
  status: "draft",
  items: [
    { id: "item-1", name: "Old Item", description: null, quantity: toDecimal("1"), unit: null, price: toDecimal("500.00"), position: 0 },
  ],
  projects: [
    { projectId: "proj-old" },
  ],
};

describe("B4: updateContract persists items and projects", () => {
  beforeEach(() => {
    resetTx();
  });

  it("replaces items atomically and records audit", async () => {
    tx.contract.findUnique.mockResolvedValue({ ...existingContract });
    tx.contractItem.deleteMany.mockResolvedValue({ count: 1 });
    tx.contractItem.createMany.mockResolvedValue({ count: 2 });
    tx.contractProject.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractAudit.create.mockResolvedValue({});
    tx.contract.update.mockResolvedValue({ id: "ctr-1", status: "draft" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    await updateContract(
      "ctr-1",
      {
        items: [
          { name: "New Item A", price: "300.00", position: 0 },
          { name: "New Item B", price: "700.00", position: 1 },
        ],
      },
      "actor-1"
    );

    expect(tx.contractItem.deleteMany).toHaveBeenCalledWith({
      where: { contractId: "ctr-1" },
    });
    expect(tx.contractItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ name: "New Item A", contractId: "ctr-1" }),
        expect.objectContaining({ name: "New Item B", contractId: "ctr-1" }),
      ]),
    });

    const auditCalls = tx.contractAudit.create.mock.calls;
    const itemsAudit = auditCalls.find(
      (call: unknown[]) => {
        const arg = call[0] as { data?: { field?: string } } | undefined;
        return arg?.data?.field === "items";
      }
    );
    expect(itemsAudit).toBeDefined();
    const itemsArg = (itemsAudit as unknown[])[0] as { data: { beforeValue: unknown; afterValue: unknown } };
    expect(itemsArg.data.beforeValue).toEqual([
      { name: "Old Item", description: null, quantity: "1", unit: null, price: "500", position: 0 },
    ]);
    expect(itemsArg.data.afterValue).toEqual([
      { name: "New Item A", price: "300.00", position: 0 },
      { name: "New Item B", price: "700.00", position: 1 },
    ]);
  });

  it("replaces projects atomically and records audit", async () => {
    tx.contract.findUnique.mockResolvedValue({ ...existingContract });
    tx.contractItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractProject.deleteMany.mockResolvedValue({ count: 1 });
    tx.contractProject.createMany.mockResolvedValue({ count: 2 });
    tx.contractProject.findFirst.mockResolvedValue(null);
    tx.contractAudit.create.mockResolvedValue({});
    tx.contract.update.mockResolvedValue({ id: "ctr-1", status: "draft" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    await updateContract(
      "ctr-1",
      {
        projectIds: ["proj-a", "proj-b"],
      },
      "actor-1"
    );

    expect(tx.contractProject.deleteMany).toHaveBeenCalledWith({
      where: { contractId: "ctr-1" },
    });
    expect(tx.contractProject.createMany).toHaveBeenCalledWith({
      data: [
        { contractId: "ctr-1", projectId: "proj-a" },
        { contractId: "ctr-1", projectId: "proj-b" },
      ],
    });

    const auditCalls = tx.contractAudit.create.mock.calls;
    const projectsAudit = auditCalls.find(
      (call: unknown[]) => {
        const arg = call[0] as { data?: { field?: string } } | undefined;
        return arg?.data?.field === "projects";
      }
    );
    expect(projectsAudit).toBeDefined();
    const projectsArg = (projectsAudit as unknown[])[0] as { data: { beforeValue: unknown; afterValue: unknown } };
    expect(projectsArg.data.beforeValue).toEqual(["proj-old"]);
    expect(projectsArg.data.afterValue).toEqual(["proj-a", "proj-b"]);
  });

  it("rejects project conflict for active contracts", async () => {
    tx.contract.findUnique.mockResolvedValue({
      ...existingContract,
      status: "active",
    });
    tx.contractProject.findFirst.mockResolvedValue({ contractId: "other-active" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    const { FinancialConflictError } = await import("../lib/financial/lifecycle");

    await expect(
      updateContract("ctr-1", { projectIds: ["proj-conflict"] }, "actor-1")
    ).rejects.toThrow(FinancialConflictError);

    await expect(
      updateContract("ctr-1", { projectIds: ["proj-conflict"] }, "actor-1")
    ).rejects.toThrow("already belongs to another active contract");

    expect(tx.contractProject.deleteMany).not.toHaveBeenCalled();
  });

  it("allows project update on draft contracts without conflict check", async () => {
    tx.contract.findUnique.mockResolvedValue({ ...existingContract });
    tx.contractItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractProject.deleteMany.mockResolvedValue({ count: 1 });
    tx.contractProject.createMany.mockResolvedValue({ count: 1 });
    tx.contractAudit.create.mockResolvedValue({});
    tx.contract.update.mockResolvedValue({ id: "ctr-1", status: "draft" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    await updateContract(
      "ctr-1",
      { projectIds: ["proj-new"] },
      "actor-1"
    );

    expect(tx.contractProject.findFirst).not.toHaveBeenCalled();
    expect(tx.contractProject.createMany).toHaveBeenCalled();
  });

  it("clears all items when empty array is sent", async () => {
    tx.contract.findUnique.mockResolvedValue({ ...existingContract });
    tx.contractItem.deleteMany.mockResolvedValue({ count: 1 });
    tx.contractProject.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractAudit.create.mockResolvedValue({});
    tx.contract.update.mockResolvedValue({ id: "ctr-1", status: "draft" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    await updateContract("ctr-1", { items: [] }, "actor-1");

    expect(tx.contractItem.deleteMany).toHaveBeenCalled();
    expect(tx.contractItem.createMany).not.toHaveBeenCalled();
  });

  it("preserves scalar updates alongside items/projects", async () => {
    tx.contract.findUnique.mockResolvedValue({ ...existingContract });
    tx.contractItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractItem.createMany.mockResolvedValue({ count: 1 });
    tx.contractProject.deleteMany.mockResolvedValue({ count: 0 });
    tx.contractAudit.create.mockResolvedValue({});
    tx.contract.update.mockResolvedValue({ id: "ctr-1", status: "draft" });

    const { updateContract } = await import("../lib/financial/contracts-service");
    await updateContract(
      "ctr-1",
      {
        title: "Updated Title",
        officialValue: "2000.00",
        items: [{ name: "Service", price: "2000.00", position: 0 }],
      },
      "actor-1"
    );

    expect(tx.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ctr-1" },
        data: expect.objectContaining({
          title: "Updated Title",
          officialValue: toDecimal("2000.00"),
        }),
      })
    );
  });
});

function readForm(): string {
  return readFileSync(
    resolve(__dirname, "../components/financial/contracts/contract-form.tsx"),
    "utf8"
  );
}
