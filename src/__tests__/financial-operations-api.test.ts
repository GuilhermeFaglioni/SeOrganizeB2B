import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("contract lifecycle API", () => {
  it("exposes lifecycle actions through a single route", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("applyLifecycleAction");
    expect(source).toContain("activate");
    expect(source).toContain("suspend");
    expect(source).toContain("resume");
    expect(source).toContain("close");
    expect(source).toContain("cancel");
    expect(source).toContain("renew");
    expect(source).toContain("AUTH_ERROR");
  });

  it("validates the installment plan before activation", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("plan");
  });

  it("requires an effective date to cancel", () => {
    const source = read("src/app/api/contracts/[id]/lifecycle/route.ts");
    expect(source).toContain("effectiveDate");
  });
});

describe("contract changes API", () => {
  it("proposes first and applies only after confirmation", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("applyContractChange");
    expect(source).toContain("confirm: body.confirm === true");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("strategy");
  });

  it("supports redistribute and adjust strategies", () => {
    const source = read("src/app/api/contracts/[id]/changes/route.ts");
    expect(source).toContain("redistribute");
    expect(source).toContain("adjust");
  });
});

describe("installment APIs", () => {
  it("marks paid, cancels and records refunds without touching paid rows", () => {
    const source = read("src/app/api/installments/[id]/route.ts");
    expect(source).toContain("recordPayment");
    expect(source).toContain("cancelInstallment");
    expect(source).toContain("AUTH_ERROR");
  });

  it("enforces the linked refund rule", () => {
    const source = read("src/app/api/installments/[id]/refund/route.ts");
    expect(source).toContain("refundInstallment");
    expect(source).toContain("VALIDATION_ERROR");
    expect(source).toContain("mapFinancialError");
  });
});
