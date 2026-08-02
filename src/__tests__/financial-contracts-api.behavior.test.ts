import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockCreateContractDraft, mockUpdateContract, mockDeleteDraftContract } =
  vi.hoisted(() => ({
    mockPrisma: {
      contract: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
    },
    mockCreateContractDraft: vi.fn(),
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
    return mockCreateContractDraft;
  },
  get updateContract() {
    return mockUpdateContract;
  },
  get deleteDraftContract() {
    return mockDeleteDraftContract;
  },
}));

import { GET as listContracts, POST as createContract } from "../app/api/contracts/route";
import {
  GET as getContract,
  PATCH as patchContract,
  DELETE as deleteContract,
} from "../app/api/contracts/[id]/route";

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
  ownerId: null,
  client: { id: "client-1", name: "Acme" },
};

describe("contracts API route behavior", () => {
  beforeEach(() => {
    mockPrisma.contract.findMany.mockReset();
    mockPrisma.contract.count.mockReset();
    mockPrisma.contract.findUnique.mockReset();
    mockCreateContractDraft.mockReset();
    mockUpdateContract.mockReset();
    mockDeleteDraftContract.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/contracts (list)", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("@/lib/supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await listContracts(makeRequest("http://x/api/contracts"));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("AUTH_ERROR");
    });

    it("returns paginated contracts with default page/pageSize", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContract]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const res = await listContracts(makeRequest("http://x/api/contracts"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items).toHaveLength(1);
      expect(json.data.total).toBe(1);
      expect(json.data.page).toBe(1);
      expect(json.data.pageSize).toBe(25);
      expect(json.data.totalPages).toBe(1);

      const findManyArgs = mockPrisma.contract.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(0);
      expect(findManyArgs.take).toBe(25);
    });

    it("clamps pageSize above max to 100", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      const res = await listContracts(
        makeRequest("http://x/api/contracts?pageSize=999")
      );
      const json = await res.json();
      expect(json.data.pageSize).toBe(100);
    });

    it("applies status filter", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?status=active")
      );

      const where = mockPrisma.contract.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("active");
    });

    it("applies clientId filter", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?clientId=c-1")
      );

      const where = mockPrisma.contract.findMany.mock.calls[0][0].where;
      expect(where.clientId).toBe("c-1");
    });

    it("applies projectId filter via nested some", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?projectId=p-1")
      );

      const where = mockPrisma.contract.findMany.mock.calls[0][0].where;
      expect(where.projects).toEqual({ some: { projectId: "p-1" } });
    });

    it("applies search across title, code, and client name", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?search=acme")
      );

      const where = mockPrisma.contract.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(3);
      expect(where.OR[0]).toEqual({
        title: { contains: "acme", mode: "insensitive" },
      });
    });

    it("applies custom sort", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?sortBy=officialValue&sortDir=asc")
      );

      const findManyArgs = mockPrisma.contract.findMany.mock.calls[0][0];
      expect(findManyArgs.orderBy).toEqual({ officialValue: "asc" });
    });

    it("falls back to createdAt for invalid sortBy", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await listContracts(
        makeRequest("http://x/api/contracts?sortBy=invalidField")
      );

      const findManyArgs = mockPrisma.contract.findMany.mock.calls[0][0];
      expect(findManyArgs.orderBy).toEqual({ createdAt: "desc" });
    });

    it("paginates correctly on page 2", async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(50);

      await listContracts(
        makeRequest("http://x/api/contracts?page=2&pageSize=25")
      );

      const findManyArgs = mockPrisma.contract.findMany.mock.calls[0][0];
      expect(findManyArgs.skip).toBe(25);
      expect(findManyArgs.take).toBe(25);
    });
  });

  describe("POST /api/contracts (create)", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("@/lib/supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await createContract(makeRequest("http://x/api/contracts", {}));
      expect(res.status).toBe(401);
    });

    it("returns 400 when title is missing", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { clientId: "c1", durationType: "fixed", officialValue: "100", startDate: "2026-09-01" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("Title");
      expect(mockCreateContractDraft).not.toHaveBeenCalled();
    });

    it("returns 400 when clientId is missing", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { title: "T", durationType: "fixed", officialValue: "100", startDate: "2026-09-01" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("Client");
    });

    it("returns 400 when durationType is invalid", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { title: "T", clientId: "c1", durationType: "invalid", officialValue: "100", startDate: "2026-09-01" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("duration type");
    });

    it("returns 400 when officialValue is not a valid number string", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { title: "T", clientId: "c1", durationType: "fixed", officialValue: "abc", startDate: "2026-09-01" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("Official value");
    });

    it("returns 400 when startDate is missing", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { title: "T", clientId: "c1", durationType: "fixed", officialValue: "100" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("start date");
    });

    it("returns 400 when startDate is invalid format", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", { title: "T", clientId: "c1", durationType: "fixed", officialValue: "100", startDate: "01-09-2026" })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when endDate is invalid format", async () => {
      const res = await createContract(
        makeRequest("http://x/api/contracts", {
          title: "T", clientId: "c1", durationType: "fixed", officialValue: "100",
          startDate: "2026-09-01", endDate: "invalid-date",
        })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("End date");
    });

    it("creates a draft contract and returns 201", async () => {
      const created = { ...mockContract, id: "new-1" };
      mockCreateContractDraft.mockResolvedValue(created);

      const res = await createContract(
        makeRequest("http://x/api/contracts", {
          title: "New Contract",
          clientId: "client-1",
          durationType: "fixed",
          officialValue: "5000",
          startDate: "2026-09-01",
          endDate: "2027-08-31",
          billingFrequency: "monthly",
          paymentMethod: "pix",
          items: [{ name: "Service", price: "5000", position: 0 }],
          projectIds: ["proj-1"],
        })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.id).toBe("new-1");
      expect(json.error).toBeNull();
      expect(mockCreateContractDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Contract",
          clientId: "client-1",
          durationType: "fixed",
          officialValue: "5000",
          startDate: "2026-09-01",
        }),
        "user-1"
      );
    });

    it("passes null for optional fields when omitted", async () => {
      mockCreateContractDraft.mockResolvedValue(mockContract);

      await createContract(
        makeRequest("http://x/api/contracts", {
          title: "T",
          clientId: "c1",
          durationType: "fixed",
          officialValue: "100",
          startDate: "2026-09-01",
        })
      );

      expect(mockCreateContractDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: null,
          endDate: null,
          billingFrequency: null,
          paymentMethod: "pix",
          documentUrl: null,
          notes: null,
          items: [],
          projectIds: [],
        }),
        "user-1"
      );
    });

    it("returns 409 when service throws FinancialConflictError", async () => {
      const err = new Error("Conflict") as Error & { name: string };
      err.name = "FinancialConflictError";
      mockCreateContractDraft.mockRejectedValue(err);

      const res = await createContract(
        makeRequest("http://x/api/contracts", {
          title: "T", clientId: "c1", durationType: "fixed", officialValue: "100", startDate: "2026-09-01",
        })
      );
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("CONFLICT");
    });

    it("returns 500 for unexpected errors", async () => {
      mockCreateContractDraft.mockRejectedValue(new Error("boom"));

      const res = await createContract(
        makeRequest("http://x/api/contracts", {
          title: "T", clientId: "c1", durationType: "fixed", officialValue: "100", startDate: "2026-09-01",
        })
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("GET /api/contracts/[id] (detail)", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("@/lib/supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await getContract(makeRequest("http://x/api/contracts/ctr-1"), {
        params: { id: "ctr-1" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when contract not found", async () => {
      mockPrisma.contract.findUnique.mockResolvedValue(null);

      const res = await getContract(makeRequest("http://x/api/contracts/missing"), {
        params: { id: "missing" },
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("returns full contract detail with all includes", async () => {
      const fullContract = {
        ...mockContract,
        owner: null,
        predecessor: null,
        successors: [],
        items: [],
        projects: [],
        installments: [],
        changes: [],
        audits: [],
      };
      mockPrisma.contract.findUnique.mockResolvedValue(fullContract);

      const res = await getContract(makeRequest("http://x/api/contracts/ctr-1"), {
        params: { id: "ctr-1" },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe("ctr-1");
      expect(json.data.items).toBeDefined();
      expect(json.data.projects).toBeDefined();
      expect(json.data.installments).toBeDefined();
      expect(json.data.changes).toBeDefined();
      expect(json.data.audits).toBeDefined();
      expect(json.error).toBeNull();

      const includeArg = mockPrisma.contract.findUnique.mock.calls[0][0].include;
      expect(includeArg).toHaveProperty("client");
      expect(includeArg).toHaveProperty("owner");
      expect(includeArg).toHaveProperty("items");
      expect(includeArg).toHaveProperty("projects");
      expect(includeArg).toHaveProperty("installments");
      expect(includeArg).toHaveProperty("changes");
      expect(includeArg).toHaveProperty("audits");
    });
  });

  describe("PATCH /api/contracts/[id] (update)", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("@/lib/supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 when startDate is invalid on PATCH", async () => {
      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", { startDate: "bad" }),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("Start date");
      expect(mockUpdateContract).not.toHaveBeenCalled();
    });

    it("calls updateContract with whitelisted fields and actor id", async () => {
      mockUpdateContract.mockResolvedValue(mockContract);

      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", {
          title: "Updated",
          officialValue: "2000",
          notes: "new notes",
        }),
        { params: { id: "ctr-1" } }
      );

      expect(res.status).toBe(200);
      expect(mockUpdateContract).toHaveBeenCalledWith(
        "ctr-1",
        expect.objectContaining({
          title: "Updated",
          officialValue: "2000",
          notes: "new notes",
        }),
        "user-1"
      );
    });

    it("forwards items and projectIds to updateContract", async () => {
      mockUpdateContract.mockResolvedValue(mockContract);

      const items = [
        { name: "Service", price: "1000", position: 0 },
      ];
      const projectIds = ["proj-1", "proj-2"];

      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", {
          items,
          projectIds,
        }),
        { params: { id: "ctr-1" } }
      );

      expect(res.status).toBe(200);
      expect(mockUpdateContract).toHaveBeenCalledWith(
        "ctr-1",
        expect.objectContaining({
          items,
          projectIds,
        }),
        "user-1"
      );
    });

    it("converts officialValue to string", async () => {
      mockUpdateContract.mockResolvedValue(mockContract);

      await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", { officialValue: 3000 }),
        { params: { id: "ctr-1" } }
      );

      expect(mockUpdateContract).toHaveBeenCalledWith(
        "ctr-1",
        expect.objectContaining({ officialValue: "3000" }),
        "user-1"
      );
    });

    it("returns 409 when service throws FinancialConflictError", async () => {
      const err = new Error("Only draft and active contracts can be edited") as Error & { name: string };
      err.name = "FinancialConflictError";
      mockUpdateContract.mockRejectedValue(err);

      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("CONFLICT");
    });

    it("returns 500 for unexpected errors", async () => {
      mockUpdateContract.mockRejectedValue(new Error("boom"));

      const res = await patchContract(
        makeRequest("http://x/api/contracts/ctr-1", { title: "X" }),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("DELETE /api/contracts/[id] (delete)", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("@/lib/supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const res = await deleteContract(makeRequest("http://x/api/contracts/ctr-1", undefined, "DELETE"), {
        params: { id: "ctr-1" },
      });
      expect(res.status).toBe(401);
    });

    it("deletes a draft contract and returns 200", async () => {
      mockDeleteDraftContract.mockResolvedValue(undefined);

      const res = await deleteContract(
        makeRequest("http://x/api/contracts/ctr-1", undefined, "DELETE"),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeNull();
      expect(json.error).toBeNull();
      expect(mockDeleteDraftContract).toHaveBeenCalledWith("ctr-1");
    });

    it("returns 409 when contract is not a draft", async () => {
      const err = new Error("Only draft contracts can be deleted") as Error & { name: string };
      err.name = "FinancialConflictError";
      mockDeleteDraftContract.mockRejectedValue(err);

      const res = await deleteContract(
        makeRequest("http://x/api/contracts/ctr-1", undefined, "DELETE"),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("CONFLICT");
    });

    it("returns 500 for unexpected errors", async () => {
      mockDeleteDraftContract.mockRejectedValue(new Error("boom"));

      const res = await deleteContract(
        makeRequest("http://x/api/contracts/ctr-1", undefined, "DELETE"),
        { params: { id: "ctr-1" } }
      );
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
