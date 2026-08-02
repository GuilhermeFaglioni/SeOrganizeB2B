import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NextRequest } from "next/server";
import { csvEscape } from "@/lib/financial/csv";
import { mapFinancialError } from "@/lib/financial/http";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "@/lib/financial/lifecycle";

// --- Mocks for Contract PATCH route ---

const { mockPrisma, mockUpdateContract, mockDeleteDraftContract } = vi.hoisted(() => ({
  mockPrisma: {
    contract: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  mockUpdateContract: vi.fn(),
  mockDeleteDraftContract: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/financial/contracts-service", () => ({
  get createContractDraft() {
    return vi.fn();
  },
  get updateContract() {
    return mockUpdateContract;
  },
  get deleteDraftContract() {
    return mockDeleteDraftContract;
  },
}));

import { PATCH as patchContract } from "../app/api/contracts/[id]/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const mockContract = {
  id: "ctr-1",
  code: "CTR-2026-0001",
  title: "Test Contract",
  status: "draft",
  durationType: "fixed",
  officialValue: "1000.00",
  startDate: "2026-09-01",
  endDate: "2027-08-31",
  billingFrequency: "monthly",
  paymentMethod: "pix",
  clientId: "client-1",
  client: { id: "client-1", name: "Acme" },
};

describe("1. status removal from PATCH whitelist", () => {
  beforeEach(() => {
    mockUpdateContract.mockReset();
    mockDeleteDraftContract.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not forward status to updateContract", async () => {
    mockUpdateContract.mockResolvedValue(mockContract);

    await patchContract(
      makeRequest("http://x/api/contracts/ctr-1", {
        title: "Updated",
        status: "active",
      }),
      { params: { id: "ctr-1" } }
    );

    expect(mockUpdateContract).toHaveBeenCalledWith(
      "ctr-1",
      expect.not.objectContaining({ status: expect.anything() }),
      "user-1"
    );
    expect(mockUpdateContract).toHaveBeenCalledWith(
      "ctr-1",
      expect.objectContaining({ title: "Updated" }),
      "user-1"
    );
  });

  it("still forwards other whitelisted fields", async () => {
    mockUpdateContract.mockResolvedValue(mockContract);

    await patchContract(
      makeRequest("http://x/api/contracts/ctr-1", {
        title: "X",
        officialValue: "2000",
        notes: "n",
      }),
      { params: { id: "ctr-1" } }
    );

    expect(mockUpdateContract).toHaveBeenCalledWith(
      "ctr-1",
      expect.objectContaining({
        title: "X",
        officialValue: "2000",
        notes: "n",
      }),
      "user-1"
    );
  });
});

// --- csvEscape formula injection ---

describe("2. csvEscape neutralizes leading formula characters", () => {
  it("prepends apostrophe before leading =", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("prepends apostrophe before leading +", () => {
    expect(csvEscape("+cmd|'/C calc'!A0")).toBe("'+cmd|'/C calc'!A0");
  });

  it("prepends apostrophe before leading -", () => {
    expect(csvEscape("-1+2")).toBe("'-1+2");
  });

  it("prepends apostrophe before leading @", () => {
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("prepends apostrophe before leading tab", () => {
    expect(csvEscape("\tformula")).toBe("'\tformula");
  });

  it("prepends apostrophe before leading CR", () => {
    const result = csvEscape("\rformula");
    expect(result).toContain("'");
    expect(result).toContain("\rformula");
  });

  it("does not prepend apostrophe for mid-string formula chars", () => {
    expect(csvEscape("ok=bad")).toBe("ok=bad");
  });

  it("does not prepend apostrophe for plain strings", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("neutralizes leading formula char AND quotes if needed", () => {
    expect(csvEscape('=a"b')).toBe("\"'=a\"\"b\"");
  });

  it("returns empty string for null", () => {
    expect(csvEscape(null)).toBe("");
  });
});

// --- Central error mapper ---

describe("3. mapFinancialError central mapper", () => {
  it("returns 400 VALIDATION_ERROR for FinancialValidationError", () => {
    const res = mapFinancialError(new FinancialValidationError("bad input"));
    expect(res.status).toBe(400);
  });

  it("returns 409 CONFLICT for FinancialConflictError", () => {
    const res = mapFinancialError(new FinancialConflictError("conflict"));
    expect(res.status).toBe(409);
  });

  it("returns 500 INTERNAL_ERROR for unexpected errors", () => {
    const res = mapFinancialError(new Error("boom"));
    expect(res.status).toBe(500);
  });

  it("returns 500 for unknown throwables", () => {
    const res = mapFinancialError("string error");
    expect(res.status).toBe(500);
  });
});

describe("3b. financial routes use mapFinancialError (behavior)", () => {
  beforeEach(() => {
    mockUpdateContract.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on FinancialValidationError from PATCH", async () => {
    mockUpdateContract.mockRejectedValue(
      new FinancialValidationError("Contract not found")
    );

    const res = await patchContract(
      makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toBe("Contract not found");
  });

  it("returns 409 on FinancialConflictError from PATCH", async () => {
    mockUpdateContract.mockRejectedValue(
      new FinancialConflictError("Only draft and active contracts can be edited")
    );

    const res = await patchContract(
      makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT");
  });

  it("returns 500 with generic message on unexpected error from PATCH", async () => {
    mockUpdateContract.mockRejectedValue(new Error("db exploded"));

    const res = await patchContract(
      makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("An unexpected error occurred");
  });
});

// --- Audit records in installment operations ---

const { mockRecordPayment, mockCancelInstallment, mockRefundInstallment } = vi.hoisted(
  () => ({
    mockRecordPayment: vi.fn(),
    mockCancelInstallment: vi.fn(),
    mockRefundInstallment: vi.fn(),
  })
);

vi.mock("@/lib/financial/installments-service", () => ({
  get recordPayment() {
    return mockRecordPayment;
  },
  get cancelInstallment() {
    return mockCancelInstallment;
  },
  get refundInstallment() {
    return mockRefundInstallment;
  },
}));

import { PATCH as installmentPATCH } from "../app/api/installments/[id]/route";
import { POST as refundPOST } from "../app/api/installments/[id]/refund/route";

describe("4. installment operations include audit (behavior)", () => {
  beforeEach(() => {
    mockRecordPayment.mockReset();
    mockCancelInstallment.mockReset();
    mockRefundInstallment.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recordPayment creates audit record with before/after", async () => {
    mockRecordPayment.mockResolvedValue({
      id: "inst-1",
      contractId: "ctr-1",
      status: "paid",
      paidAt: "2026-10-01",
    });

    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "pay", paidAt: "2026-10-01" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(200);
    expect(mockRecordPayment).toHaveBeenCalledWith(
      "inst-1",
      "2026-10-01",
      "user-1"
    );
  });

  it("cancelInstallment creates audit record with before/after", async () => {
    mockCancelInstallment.mockResolvedValue({
      id: "inst-1",
      contractId: "ctr-1",
      status: "cancelled",
    });

    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "cancel" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(200);
    expect(mockCancelInstallment).toHaveBeenCalledWith("inst-1", "user-1");
  });

  it("refundInstallment creates audit with refund id and amount", async () => {
    mockRefundInstallment.mockResolvedValue({
      id: "inst-refund-1",
      contractId: "ctr-1",
      expectedAmount: "-100.00",
      status: "paid",
      paidAt: "2026-10-15",
    });

    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "100",
        refundDate: "2026-10-15",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(201);
    expect(mockRefundInstallment).toHaveBeenCalledWith(
      "inst-1",
      "100",
      "2026-10-15",
      "user-1"
    );
  });
});

// --- Source-level audit verification ---

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("4b. installment services include audit calls (source check)", () => {
  it("recordPayment calls recordFinancialAudit inside the transaction", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain("recordFinancialAudit");
    expect(source).toContain('field: "installment.payment"');
    expect(source).toContain("beforeValue:");
    expect(source).toContain("afterValue:");
  });

  it("cancelInstallment calls recordFinancialAudit inside the transaction", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain('field: "installment.cancel"');
  });

  it("refundInstallment calls recordFinancialAudit with refund id and amount", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).toContain('field: "installment.refund"');
    expect(source).toContain("refundId: refund.id");
    expect(source).toContain("amount: requested.toFixed(2)");
  });

  it("does NOT audit draft create/delete or automatic horizons", () => {
    const source = read("src/lib/financial/installments-service.ts");
    expect(source).not.toContain('field: "installment.create"');
    expect(source).not.toContain('field: "installment.delete"');
    expect(source).not.toContain('field: "horizon.extend"');
  });
});
