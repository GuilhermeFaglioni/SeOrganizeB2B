import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NextRequest } from "next/server";
import { csvDocument, csvEscape, moneyCell } from "@/lib/financial/csv";
import { toDecimal } from "@/lib/financial/money";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

const { mockPrisma, mockGetUser } = vi.hoisted(() => ({
  mockPrisma: {
    contract: { findMany: vi.fn() },
    installment: { findMany: vi.fn() },
  },
  mockGetUser: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
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
  getUser: mockGetUser,
}));

describe("CSV exports", () => {
  it("shares stable English headers and BRL money formatting", () => {
    const csv = read("src/lib/financial/csv.ts");
    expect(csv).toContain("export function csvEscape");
    expect(csv).toContain("formatBRL");
    expect(csv).toContain("\\ufeff");
  });

  it("exports contracts respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/contracts/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).toContain("findMany");
    expect(source).toContain("status");
    expect(source).toContain("clientId");
    expect(source).not.toContain("skip:");
  });

  it("exports receivables respecting filters without pagination", () => {
    const source = read("src/app/api/financial/exports/receivables/route.ts");
    expect(source).toContain("AUTH_ERROR");
    expect(source).toContain("text/csv");
    expect(source).toContain("Content-Disposition");
    expect(source).not.toContain("skip:");
  });
});

describe("csvEscape", () => {
  it("returns empty string for null and undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined as unknown as null)).toBe("");
  });

  it("passes through plain values unchanged", () => {
    expect(csvEscape("simple")).toBe("simple");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes values containing commas, quotes, or line breaks", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\rline2")).toBe('"line1\rline2"');
  });
});

describe("moneyCell", () => {
  it("formats BRL with symbol and thousands separators", () => {
    const result = moneyCell(toDecimal("1234.50"));
    expect(result).toContain("1.234,50");
    expect(result).toContain("R$");
  });
});

describe("csvDocument", () => {
  it("prepends a UTF-8 BOM and appends a trailing newline", () => {
    const doc = csvDocument([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(doc).toBe("\ufeffa,b\n1,2\n");
  });
});

describe("contracts export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with AUTH_ERROR", async () => {
    mockGetUser.mockResolvedValue(null);
    const { GET } = await import(
      "@/app/api/financial/exports/contracts/route"
    );
    const res = await GET(
      new NextRequest("http://localhost/api/financial/exports/contracts")
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_ERROR");
  });

  it("streams CSV of filtered contracts with headers and no pagination", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.contract.findMany.mockResolvedValue([
      {
        code: "C-001",
        title: "Serviço, ",
        client: { name: 'Cliente "X"' },
        status: "active",
        durationType: "fixed",
        officialValue: "1000.00",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        billingFrequency: "monthly",
        paymentMethod: "pix",
        owner: { name: "Owner" },
      },
    ]);
    const { GET } = await import(
      "@/app/api/financial/exports/contracts/route"
    );
    const res = await GET(
      new NextRequest(
        "http://localhost/api/financial/exports/contracts?status=active"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="contracts.csv"'
    );
    const text = await res.text();
    expect(text).toContain("Code,Title,Client,Status");
    expect(text).toContain('"Serviço, "');
    expect(text).toContain('"Cliente ""X"""');
    expect(text).toContain("R$ 1.000,00");
  });
});

describe("receivables export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with AUTH_ERROR", async () => {
    mockGetUser.mockResolvedValue(null);
    const { GET } = await import(
      "@/app/api/financial/exports/receivables/route"
    );
    const res = await GET(
      new NextRequest("http://localhost/api/financial/exports/receivables")
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_ERROR");
  });

  it("streams CSV of filtered installments with headers and no pagination", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.installment.findMany.mockResolvedValue([
      {
        contract: {
          code: "C-001",
          title: "Contrato",
          client: { name: "Cliente" },
        },
        expectedAmount: "250.50",
        status: "paid",
        dueDate: "2026-02-01",
        paymentMethod: "boleto",
        paidAt: "2026-02-01",
      },
    ]);
    const { GET } = await import(
      "@/app/api/financial/exports/receivables/route"
    );
    const res = await GET(
      new NextRequest(
        "http://localhost/api/financial/exports/receivables?status=paid"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="receivables.csv"'
    );
    const text = await res.text();
    expect(text).toContain(
      "Contract Code,Contract Title,Client,Expected Amount (BRL),Status,Due Date,Payment Method,Paid Date"
    );
    expect(text).toContain("R$ 250,50");
  });
});
