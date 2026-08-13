import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

// ---------------------------------------------------------------------------
// Source-level assertions for invoice-service
// ---------------------------------------------------------------------------
describe("invoice service", () => {
  const source = read("src/lib/financial/invoice-service.ts");

  it("exports getInvoiceData function", () => {
    expect(source).toContain("export async function getInvoiceData");
  });

  it("exports InvoiceData interface", () => {
    expect(source).toContain("export interface InvoiceData");
  });

  it("fetches installment with contract and client", () => {
    expect(source).toContain("prisma.installment.findFirst");
    expect(source).toContain("contract:");
    expect(source).toContain("client:");
  });

  it("includes PIX key from workspace settings", () => {
    expect(source).toContain("getPixKey");
    expect(source).toContain("pixKey");
    expect(source).toContain("pixKeyConfigured");
  });

  it("formats amount using formatBRL", () => {
    expect(source).toContain("formatBRL");
    expect(source).toContain("formattedAmount");
  });

  it("throws FinancialValidationError when installment not found", () => {
    expect(source).toContain("FinancialValidationError");
    expect(source).toContain("Installment not found");
  });

  it("handles null client gracefully", () => {
    expect(source).toContain("Cliente não informado");
  });
});

// ---------------------------------------------------------------------------
// Source-level assertions for invoice API route
// ---------------------------------------------------------------------------
describe("invoice API route", () => {
  const source = read("src/app/api/installments/[id]/invoice/route.ts");

  it("exports GET handler", () => {
    expect(source).toContain("export async function GET");
  });

  it("requires authentication", () => {
    expect(source).toContain("getUser");
    expect(source).toContain("AUTH_ERROR");
  });

  it("requires receivables view permission", () => {
    expect(source).toContain("financial.receivables.view");
  });

  it("uses tenant context", () => {
    expect(source).toContain("getTenantContext");
    expect(source).toContain("withTenant");
  });

  it("calls getInvoiceData from service", () => {
    expect(source).toContain("getInvoiceData");
  });

  it("handles errors with mapFinancialError", () => {
    expect(source).toContain("mapFinancialError");
  });
});

// ---------------------------------------------------------------------------
// Source-level assertions for invoice view component
// ---------------------------------------------------------------------------
describe("invoice view component", () => {
  const source = read("src/components/financial/receivables/invoice-view.tsx");

  it("exports InvoiceView component", () => {
    expect(source).toContain("export function InvoiceView");
  });

  it("uses dialog for invoice display", () => {
    expect(source).toContain("Dialog");
    expect(source).toContain("DialogContent");
  });

  it("shows PIX key with copy button", () => {
    expect(source).toContain("copyPix");
    expect(source).toContain("navigator.clipboard.writeText");
  });

  it("shows warning when PIX key not configured", () => {
    expect(source).toContain("noPixKey");
    expect(source).toContain("pixKeyConfigured");
  });

  it("includes print functionality", () => {
    expect(source).toContain("handlePrint");
    expect(source).toContain("window.print");
  });

  it("fetches invoice data from API", () => {
    expect(source).toContain("/api/installments/");
    expect(source).toContain("/invoice");
  });
});

// ---------------------------------------------------------------------------
// Source-level assertions for installment actions
// ---------------------------------------------------------------------------
describe("installment actions with invoice", () => {
  const source = read("src/components/financial/receivables/installment-actions.tsx");

  it("imports InvoiceView component", () => {
    expect(source).toContain("import { InvoiceView }");
  });

  it("has invoiceOpen state for dialog", () => {
    expect(source).toContain("invoiceOpen");
    expect(source).toContain("setInvoiceOpen");
  });

  it("shows generate invoice button for pending installments", () => {
    expect(source).toContain("generateInvoice");
  });

  it("renders InvoiceView component", () => {
    expect(source).toContain("<InvoiceView");
    expect(source).toContain("installmentId={installment.id}");
  });
});
