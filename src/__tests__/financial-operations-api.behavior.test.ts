import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockActivateContract: vi.fn(),
  mockApplyLifecycleAction: vi.fn(),
  mockApplyContractChange: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockCancelInstallment: vi.fn(),
  mockRefundInstallment: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {},
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: vi.fn().mockResolvedValue(null),
  getEffectivePermissions: vi.fn().mockResolvedValue({
    isAdmin: true,
    roleId: 'admin',
    roleName: 'Admin',
    permissions: [],
  }),
  can: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/financial/contracts-service", () => ({
  get activateContract() {
    return mocks.mockActivateContract;
  },
  get applyLifecycleAction() {
    return mocks.mockApplyLifecycleAction;
  },
  get applyContractChange() {
    return mocks.mockApplyContractChange;
  },
}));

vi.mock("@/lib/financial/installments-service", () => ({
  get recordPayment() {
    return mocks.mockRecordPayment;
  },
  get cancelInstallment() {
    return mocks.mockCancelInstallment;
  },
  get refundInstallment() {
    return mocks.mockRefundInstallment;
  },
}));

import { POST as lifecyclePOST } from "../app/api/contracts/[id]/lifecycle/route";
import { POST as changesPOST } from "../app/api/contracts/[id]/changes/route";
import { PATCH as installmentPATCH } from "../app/api/installments/[id]/route";
import { POST as refundPOST } from "../app/api/installments/[id]/refund/route";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "../lib/financial/lifecycle";

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
  status: "active",
  durationType: "fixed",
  officialValue: "1000.00",
  startDate: "2026-09-01",
  endDate: "2027-08-31",
  billingFrequency: "monthly",
  paymentMethod: "pix",
  clientId: "client-1",
};

const mockInstallment = {
  id: "inst-1",
  contractId: "ctr-1",
  expectedAmount: "500.00",
  dueDate: "2026-10-01",
  status: "pending",
  paidAt: null,
};

describe("lifecycle route behavior", () => {
  beforeEach(() => {
    mocks.mockActivateContract.mockReset();
    mocks.mockApplyLifecycleAction.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "activate",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("AUTH_ERROR");
  });

  it("returns 400 for unknown action", async () => {
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "invalid",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toContain("Unknown lifecycle action");
  });

  it("returns 400 when activate has no plan", async () => {
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "activate",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("installment plan");
  });

  it("returns 400 when plan has invalid due date", async () => {
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "activate",
        plan: [{ expectedAmount: "500", dueDate: "bad", paymentMethod: "pix" }],
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("valid due date");
  });

  it("returns 400 when plan has invalid amount", async () => {
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "activate",
        plan: [
          { expectedAmount: "abc", dueDate: "2026-10-01", paymentMethod: "pix" },
        ],
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("valid amount");
  });

  it("calls activateContract with valid plan", async () => {
    mocks.mockActivateContract.mockResolvedValue(mockContract);

    const plan = [
      { expectedAmount: "500", dueDate: "2026-10-01", paymentMethod: "pix" },
      { expectedAmount: "500", dueDate: "2026-11-01", paymentMethod: "pix" },
    ];
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "activate",
        plan,
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockActivateContract).toHaveBeenCalledWith(
      "ctr-1",
      plan,
      "user-1"
    );
  });

  it("returns 400 when cancel has no effective date", async () => {
    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "cancel",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("effective date");
  });

  it("calls applyLifecycleAction for suspend", async () => {
    mocks.mockApplyLifecycleAction.mockResolvedValue({
      ...mockContract,
      status: "suspended",
    });

    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "suspend",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockApplyLifecycleAction).toHaveBeenCalledWith(
      "ctr-1",
      "suspend",
      { effectiveDate: undefined, retainedInstallmentIds: [] },
      "user-1"
    );
  });

  it("returns 400 on FinancialValidationError", async () => {
    mocks.mockApplyLifecycleAction.mockRejectedValue(
      new FinancialValidationError("Contract not found")
    );

    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "resume",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on FinancialConflictError", async () => {
    mocks.mockApplyLifecycleAction.mockRejectedValue(
      new FinancialConflictError("Cannot suspend a contract in status draft")
    );

    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "suspend",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT");
  });

  it("returns 500 on unexpected errors", async () => {
    mocks.mockApplyLifecycleAction.mockRejectedValue(new Error("boom"));

    const res = await lifecyclePOST(
      makeRequest("http://x/api/contracts/ctr-1/lifecycle", {
        action: "close",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("An unexpected error occurred");
  });
});

describe("changes route behavior", () => {
  beforeEach(() => {
    mocks.mockApplyContractChange.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "redistribute",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid type", async () => {
    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "invalid",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "redistribute",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("upsell or downsell");
  });

  it("returns 400 for invalid strategy", async () => {
    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "invalid",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("redistribute or adjust");
  });

  it("returns 400 for non-numeric delta", async () => {
    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "abc",
        effectiveDate: "2026-10-01",
        strategy: "redistribute",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("numeric delta");
  });

  it("returns 400 for invalid effective date", async () => {
    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "bad",
        strategy: "redistribute",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("effective date");
  });

  it("calls applyContractChange with confirm flag", async () => {
    mocks.mockApplyContractChange.mockResolvedValue({
      applied: true,
      contract: mockContract,
    });

    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "redistribute",
        confirm: true,
        description: "Extra service",
        reason: "Client request",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockApplyContractChange).toHaveBeenCalledWith(
      "ctr-1",
      {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        description: "Extra service",
        reason: "Client request",
        strategy: "redistribute",
        confirm: true,
      },
      "user-1"
    );
  });

  it("returns 400 on FinancialValidationError", async () => {
    mocks.mockApplyContractChange.mockRejectedValue(
      new FinancialValidationError("Only active contracts can be adjusted")
    );

    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "adjust",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on FinancialConflictError", async () => {
    mocks.mockApplyContractChange.mockRejectedValue(
      new FinancialConflictError("Only active contracts can be adjusted")
    );

    const res = await changesPOST(
      makeRequest("http://x/api/contracts/ctr-1/changes", {
        type: "upsell",
        delta: "500",
        effectiveDate: "2026-10-01",
        strategy: "redistribute",
      }),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT");
  });
});

describe("installment PATCH route behavior", () => {
  beforeEach(() => {
    mocks.mockRecordPayment.mockReset();
    mocks.mockCancelInstallment.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "pay" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for unknown action", async () => {
    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "unknown" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("calls recordPayment with valid date", async () => {
    mocks.mockRecordPayment.mockResolvedValue({
      ...mockInstallment,
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
    expect(mocks.mockRecordPayment).toHaveBeenCalledWith(
      "inst-1",
      "2026-10-01",
      "user-1"
    );
  });

  it("returns 400 when pay has invalid date", async () => {
    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "pay", paidAt: "bad" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("payment date");
  });

  it("calls cancelInstallment", async () => {
    mocks.mockCancelInstallment.mockResolvedValue({
      ...mockInstallment,
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
    expect(mocks.mockCancelInstallment).toHaveBeenCalledWith(
      "inst-1",
      "user-1"
    );
  });

  it("returns 400 on FinancialValidationError", async () => {
    mocks.mockRecordPayment.mockRejectedValue(
      new FinancialValidationError("Installment not found")
    );

    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "pay", paidAt: "2026-10-01" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on FinancialConflictError", async () => {
    mocks.mockRecordPayment.mockRejectedValue(
      new FinancialConflictError("Only pending installments can be paid")
    );

    const res = await installmentPATCH(
      makeRequest(
        "http://x/api/installments/inst-1",
        { action: "pay", paidAt: "2026-10-01" },
        "PATCH"
      ),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT");
  });
});

describe("refund POST route behavior", () => {
  beforeEach(() => {
    mocks.mockRefundInstallment.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "100",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-numeric refund amount", async () => {
    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "abc",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("numeric refund amount");
  });

  it("returns 400 for invalid refund date", async () => {
    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "100",
        refundDate: "bad",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("refund date");
  });

  it("calls refundInstallment and returns 201", async () => {
    mocks.mockRefundInstallment.mockResolvedValue({
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
    expect(mocks.mockRefundInstallment).toHaveBeenCalledWith(
      "inst-1",
      "100",
      "2026-10-15",
      "user-1"
    );
  });

  it("returns 400 on FinancialValidationError", async () => {
    mocks.mockRefundInstallment.mockRejectedValue(
      new FinancialValidationError("Refund amount must be positive")
    );

    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "100",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on FinancialConflictError", async () => {
    mocks.mockRefundInstallment.mockRejectedValue(
      new FinancialConflictError("Refunds must link to a paid installment")
    );

    const res = await refundPOST(
      makeRequest("http://x/api/installments/inst-1/refund", {
        refundAmount: "100",
      }),
      { params: { id: "inst-1" } }
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("CONFLICT");
  });
});
